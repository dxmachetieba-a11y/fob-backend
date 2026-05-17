import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import pkg from "@prisma/client";
const { PrismaClient } = pkg;


const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 3000;
const BOT_API_URL = process.env.BOT_API_URL; // e.g. http://YOUR_BOT_IP:5005

app.use(cors());
app.use(express.json());

// Create ticket (website)
app.post("/api/tickets/create", async (req, res) => {
  const { subject, message } = req.body;

  try {
    const ticket = await prisma.ticket.create({
      data: {
        subject,
        messages: {
          create: {
            author: "Website User",
            content: message
          }
        }
      },
      include: { messages: true }
    });

    // Notify bot to create Discord channel
    try {
      await fetch(`${BOT_API_URL}/bot/create-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.id,
          username: "Website User",
          subject,
          message
        })
      });
    } catch (err) {
      console.error("Bot connection failed:", err);
    }

    res.json({ ok: true, ticket });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

// List tickets (staff)
app.get("/api/tickets", async (req, res) => {
  const tickets = await prisma.ticket.findMany({
    orderBy: { id: "desc" }
  });
  res.json({ ok: true, tickets });
});

// Get single ticket (staff)
app.get("/api/tickets/:id", async (req, res) => {
  const id = Number(req.params.id);
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { messages: { orderBy: { id: "asc" } } }
  });
  if (!ticket) return res.status(404).json({ ok: false });
  res.json({ ok: true, ticket });
});

// Staff reply (website → Discord)
app.post("/api/tickets/message", async (req, res) => {
  const { ticketId, content } = req.body;

  const message = await prisma.message.create({
    data: {
      ticketId: Number(ticketId),
      author: "Staff",
      content
    }
  });

  // Optionally notify bot to post in Discord (if you want two-way)
  try {
    await fetch(`${BOT_API_URL}/bot/staff-reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, content })
    });
  } catch (err) {
    console.error("Bot staff reply failed:", err);
  }

  res.json({ ok: true, message });
});

// Discord → backend message sync
app.post("/api/tickets/message/discord", async (req, res) => {
  const { ticketId, authorTag, content } = req.body;

  await prisma.message.create({
    data: {
      ticketId: Number(ticketId),
      author: authorTag,
      content
    }
  });

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
