import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';
import { getConnectionStatus } from '../../../services/messageRequestHelpers';

// GET — check connection status between two users
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const otherUserId = searchParams.get('otherUserId');

    if (!userId || !otherUserId) {
      return NextResponse.json(
        { success: false, error: 'userId and otherUserId are required.' },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db('bandhan-engine');

    const status = await getConnectionStatus(db, userId, otherUserId);

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Connection Status GET Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
