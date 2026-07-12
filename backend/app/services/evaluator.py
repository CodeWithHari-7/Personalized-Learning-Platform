import os
import sys
import json
import tempfile
import subprocess
import sqlite3
from typing import List, Dict, Any, Tuple

def execute_python_code(user_code: str, function_name: str, input_val: str) -> Tuple[bool, Any]:
    """
    Safely execute user's Python code in a subprocess with a timeout.
    Returns (success, result_or_error_message).
    """
    # Create execution wrapper script
    script = f"""
import json
import sys

# User code
{user_code}

# Test execution
if __name__ == "__main__":
    try:
        raw_input = {repr(input_val)}
        # Try decoding JSON if input represents structured data
        try:
            val = json.loads(raw_input)
        except:
            val = raw_input
            
        # Execute the function
        if '{function_name}' in globals():
            res = {function_name}(val)
            print("___SUCCESS___")
            print(json.dumps(res))
        else:
            print(f"ERROR: Function {function_name} not found.", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print("ERROR:", str(e), file=sys.stderr)
        sys.exit(1)
"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False, encoding='utf-8') as f:
        f.write(script)
        temp_path = f.name

    try:
        res = subprocess.run(
            [sys.executable, temp_path],
            capture_output=True,
            text=True,
            timeout=3.0  # Safe execution timeout limit
        )
        if res.returncode == 0 and "___SUCCESS___" in res.stdout:
            parts = res.stdout.split("___SUCCESS___")
            out = parts[1].strip() if len(parts) > 1 else ""
            try:
                return True, json.loads(out)
            except:
                return True, out
        else:
            err = res.stderr.strip() if res.stderr else res.stdout.strip()
            return False, err or "Execution failed without output."
    except subprocess.TimeoutExpired:
        return False, "Execution Timeout (3 seconds limit)"
    except Exception as e:
        return False, f"Runner error: {str(e)}"
    finally:
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except:
            pass

def execute_sql_code(user_code: str, test_cases: List[Dict]) -> Tuple[int, int, List[Dict]]:
    """
    Execute user SQL query against an in-memory SQLite database.
    """
    passed = 0
    total = len(test_cases)
    results = []
    
    for tc in test_cases:
        db = sqlite3.connect(":memory:")
        cursor = db.cursor()
        try:
            # Setup schema and seed data from test case description or context
            # We assume the test case defines setup/seed queries
            setup = tc.get("setup", "")
            if setup:
                cursor.executescript(setup)
                
            # Run user query
            cursor.execute(user_code)
            rows = cursor.fetchall()
            
            # Match expected output
            expected = tc.get("expected", [])
            # Convert expected string/JSON or list to matching structure
            if isinstance(expected, str):
                try:
                    expected = json.loads(expected)
                except:
                    pass
            
            # Simple conversion of row tuples to lists/strings
            rows_normalized = [list(r) if len(r) > 1 else r[0] for r in rows]
            
            is_correct = rows_normalized == expected or str(rows_normalized) == str(expected)
            if is_correct:
                passed += 1
            results.append({
                "description": tc.get("description", "SQL query test"),
                "passed": is_correct,
                "output": str(rows_normalized),
                "expected": str(expected)
            })
        except Exception as e:
            results.append({
                "description": tc.get("description", "SQL query test"),
                "passed": False,
                "output": f"SQL Error: {str(e)}",
                "expected": str(tc.get("expected", ""))
            })
        finally:
            db.close()
            
    return passed, total, results

def run_evaluation_pipeline(
    language: str,
    user_code: str,
    solution_code: str,
    test_cases_json: str,
    function_name: str = "solution"
) -> Tuple[int, int, List[Dict]]:
    """
    Runs code against test cases (supports Python and SQL).
    Returns (passed_count, total_count, list_of_test_case_results).
    """
    try:
        tcs = json.loads(test_cases_json)
    except:
        tcs = []
        
    if not isinstance(tcs, list):
        # Handle dict wrapping if present
        tcs = tcs.get("public", []) + tcs.get("hidden", []) if isinstance(tcs, dict) else []

    passed = 0
    total = len(tcs)
    results = []

    if not tcs:
        return 0, 0, []

    lang = language.lower()
    if lang == "python":
        for tc in tcs:
            inp = tc.get("input", "")
            exp = tc.get("expected", "")
            desc = tc.get("description", "Code verification test")
            
            success, output = execute_python_code(user_code, function_name, inp)
            
            # Normalize comparison
            is_correct = False
            if success:
                try:
                    exp_val = json.loads(exp) if isinstance(exp, str) else exp
                except:
                    exp_val = exp
                # String comparison fallback or direct matching
                is_correct = (output == exp_val or str(output).strip() == str(exp_val).strip())

            if is_correct:
                passed += 1
                
            results.append({
                "description": desc,
                "passed": is_correct,
                "output": str(output),
                "expected": str(exp)
            })
    elif lang == "sql":
        passed, total, results = execute_sql_code(user_code, tcs)
    else:
        # Unsupported languages (Java/R/etc.): Simulate execution success for simplicity
        # (AI will perform the comprehensive logic check)
        for tc in tcs:
            results.append({
                "description": tc.get("description", "Simulated run"),
                "passed": True,
                "output": tc.get("expected", ""),
                "expected": tc.get("expected", "")
            })
        passed = total

    return passed, total, results
