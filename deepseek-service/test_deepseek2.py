"""DeepSeek API 同步测试脚本（带结果解析）"""
import os
import requests

API_KEY = os.getenv("DEEPSEEK_API_KEY", "sk-fca0733eef7f40ff8655c41c090b56af")
URL = "https://api.deepseek.com/v1/chat/completions"

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

data = {
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "你好"}],
    "stream": False
}

print("Testing DeepSeek API...")
response = requests.post(URL, headers=headers, json=data, timeout=30)
print("Status:", response.status_code)

result = response.json()
if "choices" in result:
    print("SUCCESS! Reply:", result["choices"][0]["message"]["content"][:100])
else:
    print("Result:", str(result)[:200])
