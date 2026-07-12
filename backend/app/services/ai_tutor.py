"""
AI Tutor Service - Gemini/Groq/OpenAI integration with prompt templates
"""
import json
from typing import List, Dict, Optional
from app.config import get_settings

settings = get_settings()

# ─── Prompt Templates ──────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are an expert AI Tutor specializing in Data Science and Machine Learning Engineering.
You help learners understand concepts, debug code, explain algorithms, and guide their learning journey.

Your capabilities:
- Explain ML/DS concepts clearly with examples
- Debug Python code and provide fixes
- Generate quizzes on any Data Science topic
- Create coding challenges with starter code
- Summarize notes and documentation
- Provide career guidance for Data Science roles
- Explain algorithms step by step

Always:
- Use Markdown formatting for clarity
- Include code examples in Python when relevant
- Use ```python code blocks``` for code
- Be encouraging and supportive
- Provide practical, actionable advice

Current context: You are helping a student on a Personalized Learning Platform for Data Science and ML Engineering."""

QUIZ_PROMPT_TEMPLATE = """Generate a quiz with exactly {num_questions} multiple choice questions about: {topic}
Difficulty: {difficulty}

Return ONLY valid JSON in this exact format (no extra text):
{{
  "questions": [
    {{
      "question": "Question text here?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "explanation": "Brief explanation of why this is correct"
    }}
  ]
}}"""

CODING_CHALLENGE_TEMPLATE = """Create a {difficulty} coding challenge about {topic} in {language}.

Return ONLY valid JSON in this exact format:
{{
  "title": "Challenge title",
  "description": "Detailed problem description with input format, output format, constraints, and public examples",
  "starter_code": "# Starter code here\\ndef solution():\\n    pass",
  "public_test_cases": [
    {{"input": "public input", "expected": "expected output", "description": "Public example test"}}
  ],
  "hidden_test_cases": [
    {{"input": "hidden input 1", "expected": "expected output 1", "description": "Hidden test case 1"}},
    {{"input": "hidden input 2", "expected": "expected output 2", "description": "Hidden test case 2"}}
  ],
  "reference_solution": "def solution():\\n    # Full correct reference implementation here",
  "hints": ["Hint 1", "Hint 2"],
  "solution_explanation": "Brief explanation of the approach"
}}"""

CODE_REVIEW_TEMPLATE = """Review this {language} code for a {topic} challenge:

```{language}
{user_code}
```

Challenge description: {challenge_description}

Provide a comprehensive, intelligent evaluation of the code. Generate an optimal reference solution internally and compare it against the user's code for Correctness, Logic, Algorithm, Time/Space Complexity, and Edge Cases. Do NOT just use string similarity.

Provide:
1. Correctness assessment
2. Algorithm assessment
3. Optimization feedback
4. Strengths & Weaknesses
5. Specific suggestions for improvement
6. An exact score out of 100 based on this weight distribution:
   - Correctness (40%)
   - Algorithm (20%)
   - Optimization (15%)
   - Edge Cases (10%)
   - Code Quality (10%)
   - Readability (5%)

IMPORTANT: You MUST include the final score EXACTLY in this format:
Score: X/100

Format your response in Markdown."""


async def call_gemini(messages: List[Dict], system: str = None) -> str:
    """Call Gemini API using google-genai"""
    from google import genai
    from google.genai import types
    
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    # Convert messages to Gemini format
    history = []
    for msg in messages[:-1]:
        history.append(types.Content(
            role="user" if msg["role"] == "user" else "model",
            parts=[types.Part(text=msg["content"])]
        ))
    
    last_message = messages[-1]["content"] if messages else ""
    
    response = client.models.generate_content(
        model='gemini-2.0-flash-001',
        contents=history + [types.Content(role="user", parts=[types.Part(text=last_message)])],
        config=types.GenerateContentConfig(
            system_instruction=system or SYSTEM_PROMPT,
            temperature=0.7,
            max_output_tokens=2048
        )
    )
    return response.text


async def analyze_certificate(image_bytes: bytes, mime_type: str, course_name: str) -> bool:
    """Analyze if an image is a valid certificate for a specific course using Gemini Vision"""
    from google import genai
    from google.genai import types
    
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    prompt = f"""
    You are an AI validation system for an educational platform.
    Look at the provided document image. Determine if it is a valid certificate of completion for the course named: "{course_name}".
    
    Rules:
    - The document must look like a legitimate certificate, diploma, or badge of completion.
    - It must relate to the topic or name of the course "{course_name}". (exact match is not necessary, but it must be highly relevant).
    
    Return EXACTLY and ONLY the word "VALID" if it passes, or "INVALID" if it fails.
    """
    
    response = client.models.generate_content(
        model='gemini-2.0-flash-001',
        contents=[
            types.Content(role="user", parts=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                types.Part.from_text(text=prompt)
            ])
        ]
    )
    
    return "VALID" in response.text.upper()


async def call_groq(messages: List[Dict], system: str = None) -> str:
    """Call Groq API"""
    from groq import Groq
    
    client = Groq(api_key=settings.GROQ_API_KEY)
    all_messages = [{"role": "system", "content": system or SYSTEM_PROMPT}] + messages
    
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=all_messages,
        temperature=0.7,
        max_tokens=2048
    )
    return response.choices[0].message.content


async def call_openai(messages: List[Dict], system: str = None) -> str:
    """Call OpenAI API"""
    from openai import AsyncOpenAI
    
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    all_messages = [{"role": "system", "content": system or SYSTEM_PROMPT}] + messages
    
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=all_messages,
        temperature=0.7,
        max_tokens=2048
    )
    return response.choices[0].message.content


async def get_ai_response(messages: List[Dict], system: str = None) -> str:
    """Route to the configured AI provider with fallback chain"""
    active_ai = settings.ACTIVE_AI.lower()
    
    providers = []
    if active_ai == "gemini":
        providers = [
            ("gemini", call_gemini, settings.GEMINI_API_KEY),
            ("groq", call_groq, settings.GROQ_API_KEY),
            ("openai", call_openai, settings.OPENAI_API_KEY),
        ]
    elif active_ai == "groq":
        providers = [
            ("groq", call_groq, settings.GROQ_API_KEY),
            ("gemini", call_gemini, settings.GEMINI_API_KEY),
            ("openai", call_openai, settings.OPENAI_API_KEY),
        ]
    else:
        providers = [
            ("openai", call_openai, settings.OPENAI_API_KEY),
            ("gemini", call_gemini, settings.GEMINI_API_KEY),
            ("groq", call_groq, settings.GROQ_API_KEY),
        ]
    
    last_error = None
    for name, fn, key in providers:
        if not key:
            continue
        try:
            result = await fn(messages, system)
            return result
        except Exception as e:
            last_error = e
            print(f"[AI] {name} failed: {e}, trying next provider...")
            continue
    
    raise Exception(f"All AI providers failed. Last error: {last_error}")


async def generate_quiz(topic: str, difficulty: str, num_questions: int) -> Dict:
    """Generate a quiz using AI"""
    prompt = QUIZ_PROMPT_TEMPLATE.format(
        topic=topic, difficulty=difficulty, num_questions=num_questions
    )
    
    response = await get_ai_response(
        [{"role": "user", "content": prompt}],
        system="You are a quiz generator. Return ONLY valid JSON. No extra text, no markdown code blocks."
    )
    
    # Clean response - remove potential markdown code fences
    cleaned = response.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    cleaned = cleaned.strip()
    
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Fallback quiz
        return {
            "questions": [
                {
                    "question": f"What is a key concept in {topic}?",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correct_answer": "Option A",
                    "explanation": "This is the correct answer based on fundamental principles."
                }
            ] * num_questions
        }


async def generate_coding_challenge(topic: str, difficulty: str, language: str) -> Dict:
    """Generate a coding challenge using AI"""
    prompt = CODING_CHALLENGE_TEMPLATE.format(
        topic=topic, difficulty=difficulty, language=language
    )
    
    response = await get_ai_response(
        [{"role": "user", "content": prompt}],
        system="You are a coding challenge creator. Return ONLY valid JSON. No markdown code blocks wrapping the JSON."
    )
    
    cleaned = response.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    cleaned = cleaned.strip()
    
    try:
        return json.loads(cleaned)
    except:
        return {
            "title": f"{difficulty} {topic} Challenge",
            "description": f"Implement a solution for {topic} in {language}.",
            "starter_code": f"# {topic} Challenge\n# Difficulty: {difficulty}\n\ndef solution(input_val):\n    # Your code here\n    return input_val\n",
            "public_test_cases": [{"input": "test", "expected": "test", "description": "Basic public test"}],
            "hidden_test_cases": [{"input": "hidden", "expected": "hidden", "description": "Basic hidden test"}],
            "reference_solution": "def solution(input_val):\n    return input_val",
            "hints": ["Think about the algorithm", "Consider edge cases"],
            "solution_explanation": "Implement the function using appropriate data structures."
        }


async def review_code(user_code: str, challenge_description: str, topic: str, language: str) -> str:
    """Review user-submitted code"""
    prompt = CODE_REVIEW_TEMPLATE.format(
        language=language,
        topic=topic,
        user_code=user_code,
        challenge_description=challenge_description
    )
    return await get_ai_response([{"role": "user", "content": prompt}])


AI_EVALUATION_TEMPLATE = """Evaluate this {language} user solution for the coding challenge:

---
CHALLENGE DESCRIPTION:
{challenge_description}

---
REFERENCE SOLUTION:
{reference_code}

---
USER CODE:
{user_code}

---
FUNCTIONAL TEST CASES RESULTS:
{test_cases_summary}

---
Provide a comprehensive evaluation of the code. Compare the user's approach with the reference solution, but do NOT penalize correct alternative solutions simply because they differ.
Respond ONLY with a valid JSON block containing:
{{
  "logic": 90,                  // score out of 100 for logic and algorithm choice
  "edge_cases": 85,             // score out of 100 for edge-case handling
  "code_quality": 80,           // score out of 100 for style, readability, and efficiency
  "reference_similarity": 75,   // score out of 100 for relevance to expected approach (do not penalize correct alternative solutions)
  "feedback": "Overall evaluation of the approach...",
  "improvements": ["Improvement suggestion 1", "Improvement suggestion 2"],
  "time_complexity": "O(N)",    // estimated time complexity
  "space_complexity": "O(1)"    // estimated space complexity
}}
"""

async def evaluate_code_ai(
    language: str,
    user_code: str,
    reference_code: str,
    challenge_description: str,
    test_cases_summary: str
) -> Dict:
    """Evaluate user code against reference and criteria using AI with strict JSON output"""
    prompt = AI_EVALUATION_TEMPLATE.format(
        language=language,
        challenge_description=challenge_description,
        reference_code=reference_code or "Not provided.",
        user_code=user_code,
        test_cases_summary=test_cases_summary
    )
    
    response = await get_ai_response(
        [{"role": "user", "content": prompt}],
        system="You are a strict, objective programming evaluator. Return ONLY valid JSON. No markdown code blocks."
    )
    
    cleaned = response.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```")[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[4:]
    cleaned = cleaned.strip()
    
    try:
        return json.loads(cleaned)
    except Exception as e:
        print(f"[AI EVAL] Failed to parse JSON: {e}. Raw response: {response}")
        return {
            "logic": 70,
            "edge_cases": 70,
            "code_quality": 70,
            "reference_similarity": 70,
            "feedback": "Could not parse detailed AI feedback due to formatting error.",
            "improvements": ["Review your solution structure.", "Check syntax and runtime bounds."],
            "time_complexity": "N/A",
            "space_complexity": "N/A"
        }

