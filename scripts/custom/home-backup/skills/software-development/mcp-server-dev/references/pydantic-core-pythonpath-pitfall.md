# PYTHONPATH shadowing a uv `.venv` (pydantic_core import failure)

## Symptom
A uv-managed project `.venv` (Python 3.13, pydantic 2.x / FastMCP) fails to import:

```
ModuleNotFoundError: No module named 'pydantic_core._pydantic_core'
```

or, after forcing a reinstall, the opposite contradiction:

```
ImportError: cannot import name 'validate_core_schema' from 'pydantic_core'
```

The host's `PYTHONPATH` env var points at the **hermes-agent** venv
(`C:\Users\works_ar\AppData\Local\hermes\hermes-agent\venv\Lib\site-packages`).
When spawned (especially by a parent process that inherits the env, or when
you `cd` into the project and run the venv python directly), Python prepends
that path to `sys.path`. The hermes venv ships a *different* pydantic_core
build, so the project `.venv`'s `pydantic_core` is never loaded — and the
`.pyd` native module of the hermes copy is incompatible with the project's
`pydantic`, producing the error above.

## Diagnosis (one command)
Run the project venv python with PYTHONPATH unset and inspect the path:

```
cd C:\jarvis\projects\<proj>\mcp
env -u PYTHONPATH .venv\Scripts\python.exe -c "import pydantic, pydantic_core; print(pydantic.__version__, pydantic_core.__version__)"
```

If that prints cleanly but the plain `.venv\Scripts\python.exe ...` fails,
`PYTHONPATH` is the culprit (print `echo %PYTHONPATH%` / `echo $PYTHONPATH`).

## Fix
Clear PYTHONPATH for every launch of this server. Two options:

1. **Launcher script** (preferred for manual / double-click runs):
   ```bat
   @echo off
   setlocal
   set PYTHONPATH=
   cd /d "C:\jarvis\projects\<proj>\mcp"
   .venv\Scripts\python.exe main.py
   endlocal
   ```
2. **Inline in shell**: `env -u PYTHONPATH .venv/Scripts/python.exe main.py`
   (bash/git-bash). On Windows cmd use `set PYTHONPATH=` before the command.

Do NOT "fix" this by `pip install --force-reinstall pydantic-core` into the
project venv — that only swaps one incompatible wheel for another and can
corrupt the host hermes-agent venv. The root cause is env inheritance, not
the package version.

## Why `run_server.cmd` (not a `.bat` as Hermes `command`)
Hermes launches MCP `command` **without a shell**, so a `.bat`/`.sh` launcher
as `command` fails silently. If registering in Hermes, pass the venv
`python.exe` directly as `command` and bake env prep into `server.py` (the
`sys.path` insert guard already recommended in SKILL.md). For *manual* runs,
the `set PYTHONPATH=` launcher is fine.
