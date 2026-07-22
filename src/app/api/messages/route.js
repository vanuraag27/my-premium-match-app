import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";

// GET Conversation
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const senderId = String(
      searchParams.get("senderId") || ""
    );

    const receiverId = String(
      searchParams.get("receiverId") || ""
    );

    if (!senderId || !receiverId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "senderId and receiverId are required.",
        },
        { status: 400 }
      );
    }

    const db = await getDatabase();

    const rawMessages = await db
      .collection("messages")
      .find({
        $or: [
          {
            senderId,
            receiverId,
          },
          {
            senderId: receiverId,
            receiverId: senderId,
          },
        ],
      })
      .sort({
        createdAt: 1,
        timestamp: 1,
      })
      .toArray();

    const messages = rawMessages.map((msg) => ({
      _id: msg._id.toString(),
      senderId: String(msg.senderId),
      receiverId: String(msg.receiverId),
      text:
        msg.text ||
        msg.message ||
        msg.content ||
        "",
      createdAt:
        msg.createdAt ||
        msg.timestamp ||
        new Date().toISOString(),
      read: Boolean(msg.read),
    }));

    console.log(
      `GET: ${senderId} -> ${receiverId} (${messages.length} messages)`
    );

    return NextResponse.json(
      {
        success: true,
        messages,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "GET /api/messages error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}

// POST Message
export async function POST(req) {
  try {
    const body = await req.json();

    const senderId = String(
      body.senderId || ""
    );

    const receiverId = String(
      body.receiverId || ""
    );

    const text = (
      body.text ||
      body.message ||
      body.content ||
      ""
    ).trim();

    if (!senderId || !receiverId || !text) {
      return NextResponse.json(
        {
          success: false,
          error:
            "senderId, receiverId and text are required.",
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      "POST:",
      senderId,
      receiverId,
      text
    );

    const db = await getDatabase();

    const newMessage = {
      senderId,
      receiverId,
      text,
      createdAt: new Date().toISOString(),
      read: false,
    };

    const result = await db
      .collection("messages")
      .insertOne(newMessage);

    return NextResponse.json(
      {
        success: true,
        message: {
          ...newMessage,
          _id: result.insertedId.toString(),
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "POST /api/messages error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}