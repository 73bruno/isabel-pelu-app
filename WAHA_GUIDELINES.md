# WAHA Best Practices & Anti-Blocking Guidelines

## 1. Core Principles (Avoid Bans)
*   **Reactive Approach:** "Only Reply to Messages". Never initiate conversations if possible.
    *   *Strategy:* Use `https://wa.me/PHONE?text=Hola...` links to let users start the chat.
*   **Consent First:** Never spam. Send relevant content only.
*   **Human Behavior Simulation:**
    1.  `POST /api/sendSeen/` (Mark as read)
    2.  `POST /api/startTyping/`
    3.  Wait random interval (depending on message length).
    4.  `POST /api/stopTyping/`
    5.  `POST /api/sendText/`
*   **Volume Control:**
    *   Don't send 24/7.
    *   Max ~4 messages per hour/contact.
    *   Pause between "batches" of messages.

## 2. Technical Implementation Rules
*   **Variable Delays:** Never use fixed times (like exactly 500ms). Use random intervals (e.g., 3-10 seconds between messages).
*   **Content Variation:** Randomize message text slightly (e.g., "Hola Isabel" vs "Buenas tardes Isabel").
*   **Profile:** Ensure the WhatsApp account has a profile picture, name, and status.
*   **Area Code Grouping:** Group sends by area code if possible.
*   **HTTPS Only:** Avoid non-HTTPS links.

## 3. The "Points System" Mental Model
*   Start at 0 points.
*   Engage in conversation (they reply) = +1 point.
*   Marked as spam = -10 points.
*   Blocked = -50 points.
*   Below zero = **Banned**.

## 4. Implementation Checklist for our App
- [ ] Implement `sendWithTyping()` helper that chains `seen` -> `typing` -> `delay` -> `msg`.
- [ ] Add random "jitter" to the Cron Job scheduler (don't send all at exactly 19:00:00).
- [ ] Add `randomVariant()` to message templates.
- [ ] Ensure `WHATSAPP_COOLDOWN_MS` is randomized, not static.
