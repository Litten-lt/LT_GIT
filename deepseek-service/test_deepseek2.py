"""DeepSeek API 同步测试脚本（带结果解析）"""
import json
from pathlib import Path
import requests

cfg_path = Path(__file__).parent / "config.json"
if not cfg_path.exists():
    raise FileNotFoundError("config.json 不存在，请先配置")

with open(cfg_path, "r", encoding="utf-8") as f:
    cfg = json.load(f)

API_KEY = cfg.get("api_key", "")
URL     = cfg.get("api_url", "https://api.deepseek.com/v1/chat/completions")
MODEL   = cfg.get("model", "deepseek-chat")

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

data = {
    "model": MODEL,
    "messages": [{"role": "user", "content": "你好"}],
    "stream": False
}

print(f"测试 DeepSeek API ({MODEL})...")
response = requests.post(URL, headers=headers, json=data, timeout=30)
print("Status:", response.status_code)

result = response.json()
if "choices" in result:
    print("SUCCESS! Reply:", result["choices"][0]["message"]["content"][:100])
else:
    print("Result:", str(result)[:200])
