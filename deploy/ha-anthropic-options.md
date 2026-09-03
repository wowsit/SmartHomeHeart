# Anthropic-Konversation ohne HA-Neustart umkonfigurieren

Die Optionen der Anthropic-Integration (Prompt, Modell, max_tokens, Thinking) liegen in einem
Config-Subentry. Sie lassen sich über den Reconfigure-Flow der REST-API setzen – kein Neustart, HA lädt
den Eintrag sofort neu. `TOKEN` = Long-Lived-Token, HA per SSH-Tunnel auf `127.0.0.1:18123`.

```bash
ssh -N -L 127.0.0.1:18123:127.0.0.1:8123 wowsit@homehole &
H='Authorization: Bearer '$TOKEN; B=http://127.0.0.1:18123
ENTRY=$(curl -s -H "$H" "$B/api/config/config_entries/entry?domain=anthropic" | jq -r '.[0].entry_id')
# Subentry-ID der Konversation: WebSocket `config_entries/subentries/list` (oder aus .storage/core.config_entries)
FLOW=$(curl -s -H "$H" -H 'Content-Type: application/json' -X POST "$B/api/config/config_entries/subentries/flow" \
  -d "{\"handler\":[\"$ENTRY\",\"conversation\"],\"subentry_id\":\"$SUBENTRY\"}" | jq -r .flow_id)
# Schritt 1 (init): Prompt + Assist-API, "empfohlene Einstellungen" AUS
jq -n --rawfile p assistant/homeassistant/claude_prompt.txt '{prompt:$p, llm_hass_api:["assist"], recommended:false}' \
  | curl -s -H "$H" -H 'Content-Type: application/json' -X POST "$B/api/config/config_entries/subentries/flow/$FLOW" -d @-
# Schritt 2 (additional): Modell + Prompt-Caching
curl -s -H "$H" -H 'Content-Type: application/json' -X POST "$B/api/config/config_entries/subentries/flow/$FLOW" \
  -d '{"chat_model":"claude-haiku-4-5","prompt_caching":"prompt"}'
# Schritt 3 (model): Längenlimit, Thinking aus, keine Web-Tools  -> "reconfigure_successful"
curl -s -H "$H" -H 'Content-Type: application/json' -X POST "$B/api/config/config_entries/subentries/flow/$FLOW" \
  -d '{"max_tokens":250,"thinking_budget":0,"code_execution":false,"web_search":false,"web_search_max_uses":5,"user_location":false,"web_fetch":false,"web_fetch_max_uses":5}'
```

Aktive Werte (2026-09-03): `claude-haiku-4-5`, `max_tokens 250`, `thinking_budget 0`, `prompt_caching prompt`,
`recommended false`. **Nie wieder „empfohlene Einstellungen“ anhaken** – das setzt Thinking (1024 Token) und
`max_tokens 3000` zurück und macht den Assistenten wieder langsam und geschwätzig.

Messen: `curl -s -H "$H" -X POST $B/api/conversation/process -d '{"text":"Wie wird das Wetter morgen?","language":"de","agent_id":"conversation.claude_conversation"}'`
