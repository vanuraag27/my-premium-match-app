import { NextResponse } from 'next/server';
import dbConnect from '../../../../services/dbConnect';
import { UserProfile } from '../../../../models/User';

export async function DELETE(request) {
  try {
    await dbConnect();
    const { userId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ success: false, error: "No User ID token provided" }, { status: 400 });
    }

    const cleanId = userId.toLowerCase().trim();

    // FIXED: Target the exact 'userId' schema key instead of 'id'
    const deletionResult = await UserProfile.deleteOne({ userId: cleanId });
    
    console.log(`🗑️ Database Operation Complete. Dropped documents: ${deletionResult.deletedCount}`);
    console.log(`🗑️ Permanently dropped all user storage documents for User ID: ${cleanId}`);

    return NextResponse.json({ success: true, message: "Digital footprint deleted from database successfully." });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}