import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { createClient } from '@/app/utils/supabase/server';

/**
 * POST /api/sync-user
 * 
 * Syncs the currently authenticated Clerk user to the Supabase profiles table.
 * This should be called:
 * 1. When a user first signs up (via webhook or client-side)
 * 2. When a user updates their profile in Clerk
 * 3. Periodically to ensure data consistency
 * 
 * The function is idempotent - it will either create or update the profile.
 */
export async function POST(request: NextRequest) {
  try {
    // Get the current user from Clerk
    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - No user found' },
        { status: 401 }
      );
    }

    // Extract user data from Clerk
    const userData = {
      user_id: user.id,
      email: user.emailAddresses[0]?.emailAddress || '',
      full_name: user.fullName || user.firstName || '',
      username: user.username || generateUsername(user),
      avatar_url: user.imageUrl || '',
    };

    // Validate required fields
    if (!userData.email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Connect to Supabase
    const supabase = await createClient();

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, user_id, username')
      .eq('user_id', user.id)
      .single();

    if (existingProfile) {
      // Update existing profile (only sync fields from Clerk, don't overwrite user-editable fields)
      const { data, error } = await supabase
        .from('profiles')
        .update({
          email: userData.email,
          full_name: userData.full_name,
          avatar_url: userData.avatar_url,
          last_seen_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating profile:', error);
        return NextResponse.json(
          { error: 'Failed to update profile', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        action: 'updated',
        profile: data
      });
    } else {
      // Create new profile
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          ...userData,
          bio: '', // Default empty bio
          location: '',
          website: '',
          last_seen_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating profile:', error);
        return NextResponse.json(
          { error: 'Failed to create profile', details: error.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        action: 'created',
        profile: data
      });
    }
  } catch (error) {
    console.error('Sync user error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Internal server error', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync-user
 * 
 * Gets the current user's profile from Supabase (and creates it if it doesn't exist)
 */
export async function GET() {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createClient();

    // Try to get existing profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error fetching profile:', error);
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      );
    }

    // If profile doesn't exist, create it
    if (!profile) {
      // Trigger profile creation by calling POST internally
      const url = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
      const createRequest = new NextRequest(new URL('/api/sync-user', url), {
        method: 'POST',
      });
      return POST(createRequest);
    }

    return NextResponse.json({
      success: true,
      profile
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to generate a username from Clerk user data
 * Format: firstname_lastname or email_username or random
 */
function generateUsername(user: any): string {
  // Try to use Clerk username first
  if (user.username) {
    return user.username;
  }

  // Try to generate from name
  if (user.firstName && user.lastName) {
    return `${user.firstName}_${user.lastName}`.toLowerCase().replace(/[^a-z0-9_]/g, '');
  }

  if (user.firstName) {
    return `${user.firstName}_${Math.random().toString(36).substring(2, 6)}`.toLowerCase();
  }

  // Fallback to email username
  const email = user.emailAddresses[0]?.emailAddress;
  if (email) {
    const emailUsername = email.split('@')[0];
    return `${emailUsername}_${Math.random().toString(36).substring(2, 6)}`.toLowerCase().replace(/[^a-z0-9_]/g, '');
  }

  // Ultimate fallback - random username
  return `user_${Math.random().toString(36).substring(2, 10)}`;
}

