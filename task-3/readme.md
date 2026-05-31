# Task 3 - Here There Be Dragons

This project implements an AI-powered personal learning assistant as a Telegram bot using n8n.

## Features

- `/start` — shows bot instructions.
- `/learn [url]` — extracts learning material from a URL, summarizes it, and saves it.
- `/quiz` — lets the user select a saved topic and take a quiz.
- AI Teacher role for structured summaries.
- AI Examiner role for quiz generation and answer validation.
- Persistent storage for materials and quiz progress.

## How to use

1. Open the Telegram bot.
2. Send `/start`.
3. Send `/learn https://example.com/article`.
4. Read the generated summary.
5. Click `Start quiz` or send `/quiz`.
6. Select a saved topic.
7. Answer five multiple-choice questions.
8. Review your score and explanations.

## Workflow

The n8n workflow is exported as `Telegram Bot Router.json`.