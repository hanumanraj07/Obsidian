import json
with open('events.json') as f:
    events_data = json.load(f).get('events', [])

store = {}
for e in events_data:
    cat = e['category']
    if cat not in store:
        store[cat] = []
    store[cat].append(e)

EXPENSIVE_COST_THRESHOLD = 0.006
suggestions = []
for cat, evs in store.items():
    if len(evs) < 2:
        continue
    expensive = sum(1 for e in evs if e['audit_event'].get('cost_total', 0) > EXPENSIVE_COST_THRESHOLD)
    rate = expensive / len(evs)
    if rate > 0.5:
        suggestions.append({
            'category': cat,
            'escalation_rate': round(rate, 2),
            'suggestion': f"{int(rate * 100)}% of '{cat}' queries used a heavy model (cost > ${EXPENSIVE_COST_THRESHOLD:.4f}/call). Suggested fix: route routine '{cat}' queries to llama-3.1-8b-instant (free tier) and reserve qwen3-32b for complex cases only."
        })

insights = {'recall': None, 'reflect': None, 'routing_suggestion': suggestions[0] if suggestions else None}
with open('insights.json', 'w') as f:
    json.dump(insights, f, indent=2)
print('Generated insights.json manually based on events.json')
