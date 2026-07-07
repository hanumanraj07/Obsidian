"""
Obsidian - Hello World Test
----------------------------
Purpose: confirm the pipe works -> query goes through cascadeflow ->
routes to Groq -> response comes back -> decision gets logged.

Run this FIRST before building anything else. If this works, the
foundation for Obsidian's audit trail is solid.

Setup:
    export GROQ_API_KEY="your-groq-key-here"
    pip install cascadeflow groq --break-system-packages
"""

import os
import cascadeflow

# ---- 1. Activate cascadeflow in "observe" mode -----------------------
# observe = track everything, don't enforce budget/compliance yet.
# Once this works, we switch to "enforce" mode for the real Obsidian demo.
cascadeflow.init(mode="observe")

# ---- 2. Make a normal Groq call (via OpenAI-compatible client) -------
from openai import OpenAI  # Groq is OpenAI-SDK compatible

client = OpenAI(
    api_key=os.environ["GROQ_API_KEY"],
    base_url="https://api.groq.com/openai/v1",
)

test_queries = [
    "Where is my order #4521?",                     # routine
    "I want a refund, this is the third time!",      # escalation-worthy
    "Is my credit card number 4111-1111-1111 safe?", # sensitive/compliance
]

with cascadeflow.run() as session:
    for i, query in enumerate(test_queries, start=1):
        print(f"\n--- Query {i}: {query}")

        response = client.chat.completions.create(
            model="qwen/qwen3-32b",  # Update to a real Groq model, qwen-2.5-32b
            messages=[{"role": "user", "content": query}],
        )

        answer = response.choices[0].message.content
        print(f"Response: {answer[:150]}...")

# ---- 3. Pull the audit trail from cascadeflow -------------------------
# This is the exact data Obsidian's dashboard will visualize:
# model used, cost, latency, and decision rationale for each call.
print("\n=== AUDIT TRAIL ===")
import pprint
pprint.pprint(session.trace())
print("\n=== SUMMARY ===")
pprint.pprint(session.summary())
