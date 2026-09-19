"""
Same parsing logic as the Flask version's quick_add.py. Only difference:
`categories` here is an iterable of Category model instances (`.name`,
`.id`) instead of sqlite3.Row dicts (`["name"]`) - the parsing itself is
identical, framework-agnostic text processing either way.
"""
import re


def parse_quick_add(text, categories):
    """
    Turns a one-line quick-add like "Lunch 5.50 Food" into a transaction
    dict, or None if no amount could be found at all.

    - The first number in the text is the amount. A leading '+' on it
      (e.g. "+500 salary") marks it as income instead of an expense.
    - If any existing category name appears as a whole word/phrase
      anywhere in the remaining text, that transaction is filed under
      it (and the match is stripped from the note); otherwise it's left
      uncategorized and the caller falls back to "Other".
    - Whatever's left after removing the amount and matched category
      becomes the note.
    """
    match = re.search(r"([+-]?\d+(?:\.\d{1,2})?)", text)
    if not match:
        return None

    raw_amount = match.group(1)
    amount = abs(float(raw_amount))
    txn_type = "income" if raw_amount.startswith("+") else "expense"

    remainder = (text[: match.start()] + text[match.end() :]).strip()
    remainder = re.sub(r"\s+", " ", remainder)

    matched_category = None
    for cat in sorted(categories, key=lambda c: -len(c.name)):
        pattern = r"(?i)\b" + re.escape(cat.name) + r"\b"
        if re.search(pattern, remainder):
            matched_category = cat
            remainder = re.sub(pattern, "", remainder, count=1, flags=re.IGNORECASE)
            remainder = re.sub(r"\s+", " ", remainder).strip(" -,")
            break

    return {
        "amount": amount,
        "type": txn_type,
        "category_id": matched_category.id if matched_category else None,
        "note": remainder or None,
    }
