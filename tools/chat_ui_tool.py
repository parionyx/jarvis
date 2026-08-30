#!/usr/bin/env python3
"""Interactive chat widgets for the Hermes desktop app — buttons and forms.

Two tools in the ``desktop_ui`` toolset (GUI sessions only):

- ``show_buttons`` — NON-blocking action chips rendered inline from the tool
  call itself. Clicking a chip submits its preset message through the normal
  composer pipeline, so the answer arrives as the user's next turn. Nothing
  blocks; the widget stays in the transcript and stays clickable.

- ``show_form`` — BLOCKING structured input (like ``clarify``, but typed
  fields instead of choices). The renderer renders an inline form card,
  answers ``form.respond`` with a JSON string of field values, and the tool
  returns that payload to the agent in-turn.

Rendering lives entirely in the desktop renderer
(``apps/desktop/src/components/assistant-ui/chat-ui-tool.tsx``), which reads
the widget definition from the tool-call args. Everywhere else the schemas
never load (desktop_ui is folded in only for GUI sessions), and on a GUI
backend without a matching app build the tools degrade honestly: buttons
still return their definitions (the model can restate them as text), forms
report the bridge timeout like clarify does.
"""

import json

from tools.registry import registry, tool_error


# ---------------------------------------------------------------------------
# show_buttons — non-blocking action chips
# ---------------------------------------------------------------------------

MAX_BUTTONS = 8
MAX_LABEL_LEN = 80
MAX_MESSAGE_LEN = 4000

_VALID_STYLES = ("primary", "secondary", "destructive", "outline")


def _normalize_buttons(raw) -> list[dict]:
    """Coerce LLM-shaped button lists into clean {label, message?, style?} rows.

    Accepts bare strings (label == message), dicts with label/value/message
    keys, and drops anything unusable. Value aliases are resolved so models
    that emit ``{"value": ...}`` still work.
    """
    buttons: list[dict] = []
    if not isinstance(raw, list):
        return buttons

    for entry in raw[:MAX_BUTTONS]:
        if isinstance(entry, str):
            label = entry.strip()
            if label:
                buttons.append({"label": label[:MAX_LABEL_LEN], "message": label[:MAX_MESSAGE_LEN]})
            continue

        if not isinstance(entry, dict):
            continue

        label = str(entry.get("label") or entry.get("text") or entry.get("value") or "").strip()
        if not label:
            continue

        message = str(entry.get("message") or entry.get("action") or label).strip()
        style = str(entry.get("style") or "secondary").strip().lower()
        if style not in _VALID_STYLES:
            style = "secondary"

        row = {
            "label": label[:MAX_LABEL_LEN],
            "message": message[:MAX_MESSAGE_LEN],
            "style": style,
        }
        if entry.get("id"):
            row["id"] = str(entry["id"])[:64]

        buttons.append(row)

    return buttons


def show_buttons_tool(prompt: str, buttons=None, note: str = "") -> str:
    """Render clickable action chips under the current assistant message."""
    prompt = (prompt or "").strip()
    normalized = _normalize_buttons(buttons)

    if not prompt:
        return tool_error("prompt is required — one line telling the user what the buttons decide.")
    if not normalized:
        return tool_error(
            "buttons must be a non-empty list (up to 8). Each button is a string "
            "or {label, message?, style?} where style is primary|secondary|destructive|outline."
        )

    # Non-blocking by design: the chips render from this very tool call in the
    # desktop transcript, and a click submits `message` as the user's next
    # prompt through the composer. No gateway event, no wait.
    result = {"success": True, "prompt": prompt, "buttons": normalized}
    if note.strip():
        result["note"] = note.strip()[:500]

    return json.dumps(result, ensure_ascii=False)


SHOW_BUTTONS_SCHEMA = {
    "name": "show_buttons",
    "description": (
        "Show clickable action buttons under your reply in the Hermes desktop "
        "app. The buttons stay in the chat as persistent quick-actions — when "
        "clicked, the button's preset message is sent as the user's next "
        "message to you, so phrase each `message` as something you can act on "
        "(e.g. \"Deploy to staging\", \"Show me the diff\"). Use for menus, "
        "next-step suggestions, confirmations of COMPLETED work, or dashboard-"
        "style shortcuts. Does NOT block or wait — render the buttons and "
        "finish your turn normally. For a question you need answered BEFORE "
        "continuing, use clarify or show_form instead."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "prompt": {
                "type": "string",
                "description": "One short line above the buttons saying what they do (e.g. 'What next?').",
            },
            "buttons": {
                "type": "array",
                "maxItems": MAX_BUTTONS,
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {"type": "string", "description": "Button text (short)."},
                        "message": {
                            "type": "string",
                            "description": (
                                "Message submitted when clicked. Defaults to the "
                                "label. Make it a self-contained instruction."
                            ),
                        },
                        "style": {
                            "type": "string",
                            "enum": list(_VALID_STYLES),
                            "description": "Visual weight. Default secondary.",
                        },
                    },
                    "required": ["label"],
                },
                "description": "1-8 buttons. A bare string list also works (label == message).",
            },
            "note": {
                "type": "string",
                "description": "Optional muted hint shown under the buttons.",
            },
        },
        "required": ["prompt", "buttons"],
    },
}


registry.register(
    name="show_buttons",
    toolset="desktop_ui",
    schema=SHOW_BUTTONS_SCHEMA,
    handler=lambda args, **kw: show_buttons_tool(
        prompt=args.get("prompt", ""),
        buttons=args.get("buttons"),
        note=args.get("note", ""),
    ),
    emoji="🔘",
)


# ---------------------------------------------------------------------------
# show_form — blocking structured input
# ---------------------------------------------------------------------------

MAX_FIELDS = 12

_VALID_FIELD_TYPES = ("text", "textarea", "number", "select", "checkbox")


def _normalize_fields(raw) -> tuple[list[dict], str | None]:
    """Return (clean fields, error). Only structural errors produce an error."""
    if not isinstance(raw, list) or not raw:
        return [], "fields must be a non-empty array of field objects."

    fields: list[dict] = []
    seen_names: set[str] = set()

    for raw_field in raw[:MAX_FIELDS]:
        if not isinstance(raw_field, dict):
            continue

        name = str(raw_field.get("name") or "").strip()
        label = str(raw_field.get("label") or name or "").strip()
        if not name or not label:
            return [], "every field needs a machine name and a human label."
        if name in seen_names:
            return [], f"duplicate field name: {name}"
        seen_names.add(name)

        ftype = str(raw_field.get("type") or "text").strip().lower()
        if ftype not in _VALID_FIELD_TYPES:
            return [], f"field '{name}': type must be one of {'|'.join(_VALID_FIELD_TYPES)}."

        field: dict = {"name": name, "label": label[:120], "type": ftype}

        options_raw = raw_field.get("options")
        if ftype == "select":
            options = [
                str(o).strip()[:120]
                for o in (options_raw if isinstance(options_raw, list) else [])
                if str(o).strip()
            ]
            if not options:
                return [], f"field '{name}': select fields need a non-empty options array."
            field["options"] = options[:20]

        if raw_field.get("required") is True:
            field["required"] = True

        placeholder = str(raw_field.get("placeholder") or "").strip()
        if placeholder:
            field["placeholder"] = placeholder[:200]

        default = raw_field.get("default")
        if default is not None:
            if ftype == "checkbox":
                field["default"] = bool(default)
            elif ftype == "number":
                try:
                    field["default"] = float(default) if not float(default).is_integer() else int(float(default))
                except (TypeError, ValueError):
                    return [], f"field '{name}': number default must be numeric."
            else:
                text = str(default)
                if text.strip():
                    field["default"] = text[:2000]

        fields.append(field)

    if not fields:
        return [], "no usable fields after normalization."

    return fields, None


def show_form_tool(title: str, fields=None, submit_label: str = "", callback=None) -> str:
    """Block until the user fills the inline form card (or it times out)."""
    title = (title or "").strip()
    if not title:
        return tool_error("title is required — one line above the form saying what it collects.")

    normalized_fields, error = _normalize_fields(fields)
    if error:
        return tool_error(error)

    if callback is None:
        return tool_error("Forms are only available in the Hermes desktop app.")

    submit_label = (submit_label or "Submit").strip()[:40] or "Submit"

    try:
        raw_response = callback(title, normalized_fields, submit_label)
    except Exception as exc:
        return tool_error(f"Failed to collect form input: {exc}")

    raw_text = "" if raw_response is None else str(raw_response).strip()
    if not raw_text:
        return json.dumps(
            {
                "success": False,
                "title": title,
                "error": "The user did not fill the form within the time limit.",
            },
            ensure_ascii=False,
        )

    # The renderer answers with a JSON object {fieldName: value}; pass it
    # through parsed when possible so the model reads values directly.
    try:
        values = json.loads(raw_text)
        if not isinstance(values, dict):
            raise ValueError("not an object")
    except (ValueError, TypeError):
        values = None

    result: dict = {"success": True, "title": title, "fields_offered": [f["name"] for f in normalized_fields]}
    if values is not None:
        result["values"] = values
    else:
        result["raw_response"] = raw_text[:8000]

    return json.dumps(result, ensure_ascii=False)


SHOW_FORM_SCHEMA = {
    "name": "show_form",
    "description": (
        "Show a fillable form (text boxes, dropdowns, numbers, checkboxes) in "
        "the Hermes desktop app and WAIT for the user to submit it. Their "
        "answers come back to you as structured values keyed by field name — "
        "use them immediately in the same turn. Use for collecting several "
        "related inputs at once (contact details, config values, filters, "
        "wizard steps). BLOCKS until submit or timeout — for non-blocking "
        "quick actions use show_buttons, and for simple choice questions use "
        "clarify. Keep forms short: 2-6 fields is the sweet spot."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "title": {
                "type": "string",
                "description": "One line above the form saying what it collects.",
            },
            "fields": {
                "type": "array",
                "maxItems": MAX_FIELDS,
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "Machine name echoed back as the value key (snake_case).",
                        },
                        "label": {"type": "string", "description": "Human-readable field label."},
                        "type": {
                            "type": "string",
                            "enum": list(_VALID_FIELD_TYPES),
                            "description": "Input kind. Default text.",
                        },
                        "options": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "REQUIRED for select fields (max 20 options).",
                        },
                        "required": {"type": "boolean", "description": "Must the user fill it?"},
                        "placeholder": {"type": "string", "description": "Hint text inside empty inputs."},
                        "default": {"type": "string", "description": "Pre-filled value."},
                    },
                    "required": ["name", "label"],
                },
            },
            "submit_label": {
                "type": "string",
                "description": "Text on the submit button. Default 'Submit'.",
            },
        },
        "required": ["title", "fields"],
    },
}


registry.register(
    name="show_form",
    toolset="desktop_ui",
    schema=SHOW_FORM_SCHEMA,
    handler=lambda args, **kw: show_form_tool(
        title=args.get("title", ""),
        fields=args.get("fields"),
        submit_label=args.get("submit_label", ""),
        callback=kw.get("callback"),
    ),
    emoji="📝",
)
