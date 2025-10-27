# PROMPTS.md

This document lists the AI prompts and interactions used to assist in developing **CF AI StudyBuddy** — an AI-powered tutoring application built for the **Cloudflare AI Developer Assignment**.

---

## Overview

AI-assisted coding was used to **accelerate development**, **debug issues**, and **improve architecture and documentation**.  
All final implementation decisions, structure, and testing were performed manually by **me (the author).**

As much as I wanted to, the AI wasn't able to generate a fully functional codebase that did everything I envisioned.  
I mainly used it for:
- Creating boilerplate and project structure templates  
- Debugging errors and edge cases  
- Explaining syntax, Worker/Durable Object patterns, and Cloudflare tooling  
- Providing code review and improvement suggestions  

---

## About the Development Process

This isn't an exact list of every prompt used, I experimented a lot, often iterating and reworking the architecture to make it modular and efficient.  
I lost track of all the individual AI prompts due to the number of experiments and rewrites I performed.

Key themes across my AI-assisted prompts included:
- Designing a Cloudflare Worker and Durable Object for chat coordination  
- Connecting Workers AI (Llama 3.3) with message flow  
- Creating modular helper functions for chat, XP, and UI updates  
- Improving the readability and maintainability of `app.js`  
- Debugging issues with `wrangler`, types, and the Workers runtime  

---

## Technical Exploration

At one point, I attempted to **migrate all local storage features** (chat titles, XP stats, etc.) into a **Workers D1 database**, connected via a unique user ID.  
The goal was to make the data fully synced between devices and browsers.

However, this required rebuilding major parts of the code from scratch, and after testing the idea, I decided to **revert to the previous version** that used localStorage and Durable Object memory.  
Thankfully, I had created a full backup before attempting that migration.

---

## Example Prompts

While not exhaustive, here are representative examples of the kinds of AI prompts I used during development:
I would inspect the code that it was given to me, and select only the parts that I thought it would work for my project and won't break any interaction.
I would manually insert all the code (NO CONTROL + A, CONTROL + V)

### Prompt 1 — Backend Setup
> “Write a Cloudflare Worker that uses Durable Objects to handle a chat conversation with Workers AI (Llama 3.3).  
> Include endpoints for GET (history), POST (send message), and /reset.”

### Prompt 2 — Frontend Chat Logic
> “Create an app.js that manages chat messages. (Once I've got it working I went' to the next step)
> "Create a sidebar"
> "Help me with the renaming of the chat titles" (A lot of bugs on this one, as I also wanted to automaticly create a title from the first message)
I also had to diable the chat swapping, and entering new messages until the AI replies back to avoid major bugs.
> "Help me creating a daily XP streaks rewards, and animations using localStorage.”

### Prompt 3 — Debugging
The were several PROMPS, but one of them for example it woudl be:

> “Help me fix the TypeScript errors in my Worker code: ‘Cannot find module @cloudflare/workers-types’.  
> Also check why my fetch endpoint returns a 500 error.”

### Prompt 4 — Architecture Refinement
> “How can I make this part of my code more modular with named helper functions, avoiding repetition, and improveing async handling.”
I would look at the example, and rebuilding it on my own.

### Prompt 5 — Comments
> "Help me comment my code for easier naviation"

### Prompt 6 — Assignment Review and Last checks
> “Check if my app meets Cloudflare’s AI Developer Assignment requirements. Is there anything that I could be missing? 
> Help me creating a README.md and PROMPTS.md that looks visualy engaging.”
I found that the AI give me a very solid template to document all of my implementations in the README and PROMPTS files.

---

## Declaration

All code was written, tested, and deployed manually by me.  
AI tools were used **only as assistants** for:
- Boilerplate generation  
- Debugging guidance  
- Syntax clarification  
- Documentation improvement  

No copied or third-party code was used, every feature was implemented and verified through hands-on development and experimentation.

---

## Summary

This project fulfills the **Cloudflare AI Developer Assignment** criteria:
- **LLM:** Workers AI (Llama 3.3)  
- **Coordination:** Durable Objects  
- **Input:** Frontend Chat UI  
- **Memory/State:** Durable Object + localStorage  
- **Documentation:** README + PROMPTS included  

**Repository:** [https://github.com/ovione/cf_ai_studybuddy](https://github.com/ovione/cf_ai_studybuddy)  
**Live Demo:** [https://cf_ai_studybuddy.ovione.workers.dev](https://cf_ai_studybuddy.ovione.workers.dev)
