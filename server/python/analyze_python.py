import json
import sys
from io import StringIO
from pylint import lint
from pylint.reporters.json_reporter import JSONReporter

# --------------------- READ FILE PATH ---------------------
if len(sys.argv) < 2:
    print("ERROR: No file path provided", file=sys.stderr)
    sys.exit(1)

file_path = sys.argv[1]

with open(file_path, "r") as f:
    code = f.read()

# --------------------- PYLINT ANALYSIS ---------------------
pylint_opts = [
    "--output-format=json",
    "--enable=all",
    file_path
]

output = StringIO()
reporter = JSONReporter(output=output)

try:
    lint.Run(pylint_opts, reporter=reporter)
except Exception as e:
    print("ERROR running pylint:", e, file=sys.stderr)
    print(json.dumps([]))
    sys.exit(1)

raw_output = output.getvalue()

# --------------------- PARSE OUTPUT ---------------------
try:
    messages = json.loads(raw_output)
    suggestions = []

    for msg in messages:
        suggestions.append({
            "line": msg.get("line", 0),
            "tool": "pylint",
            "issue": msg.get("message", ""),
            "severity": msg.get("type", "Low").capitalize(),
            "suggestion": msg.get("symbol", "")
        })

    print(json.dumps(suggestions))

except Exception as e:
    print("ERROR parsing pylint output:", e, file=sys.stderr)
    print(json.dumps([]))
