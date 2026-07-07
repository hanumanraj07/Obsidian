import httpx
import json
import time

URL = "http://127.0.0.1:8000"

# First, reset the session to ensure a clean budget start
httpx.delete(f"{URL}/session")
print("Session budget reset.")

queries = [
    # order_status
    "Where is my order?",
    "Can you give me the tracking for my shipment?",
    "Has my order shipped yet?",
    "What is the delivery date for my package?",
    "order #12345 tracking status",
    "where is my stuff?",
    
    # refund
    "I want a refund for my last purchase.",
    "Cancel my order and give me my money back.",
    "How do I return this item for a refund?",
    "return policy and refund process",
    "charge error on my account, need refund",
    "can I get a refund please?",

    # sensitive_data (complex / expensive / might hit budget or trigger switch)
    "My social security number is 123-45-6789, what is my account balance?",
    "Can you update my bank account details to routing 000111222?",
    "I forgot my password and my credit card is 4111-2222-3333-4444.",
    "Update my date of birth to 01/01/1980.",
    "My cvv is 123 and personal info needs update.",
    "Here is my SSN and card number, please verify my identity.",
    "Bank account change request for my personal profile.",

    # general_faq
    "What are your business hours?",
    "Do you have a physical store?",
    "How can I contact customer support?",
    "What is your privacy policy?",
    "Are you open on weekends?",
    "Tell me about your company."
]

print(f"Sending {len(queries)} queries...")
for i, q in enumerate(queries):
    resp = httpx.post(f"{URL}/query", json={"query": q}, timeout=60.0)
    data = resp.json()
    action = data.get("audit_event", {}).get("action", "unknown")
    blocked = data.get("blocked", False)
    cost = data.get("audit_event", {}).get("cost_total", 0.0)
    print(f"[{i+1}/{len(queries)}] {q[:30]:<30} -> action={action}, blocked={blocked}, cost=${cost:.4f}")
    
    # Add a small delay
    time.sleep(1.0)

print("Fetching events...")
events_resp = httpx.get(f"{URL}/events")
with open("events.json", "w") as f:
    json.dump(events_resp.json(), f, indent=2)

print("Fetching insights...")
insights_resp = httpx.get(f"{URL}/insights")
with open("insights.json", "w") as f:
    json.dump(insights_resp.json(), f, indent=2)

print("Done! Saved events.json and insights.json.")
