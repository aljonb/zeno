import { createClient } from './supabase/client';

/**
 * Profile interface matching the Supabase profiles table
 */
export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  banner_url: string | null;
  verified: boolean;
  posts_count: number;
  followers_count: number;
  following_count: number;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
}

/**
 * Editable profile fields (user can update these)
 */
export interface EditableProfile {
  full_name?: string;
  username?: string;
  bio?: string;
  location?: string;
  website?: string;
  banner_url?: string;
}

/**
 * Fetch a user profile by username
 */
export async function getProfileByUsername(username: string): Promise<Profile | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single();

  if (error) {
    console.error('Error fetching profile by username:', error);
    return null;
  }

  return data;
}

/**
 * Fetch a user profile by user_id (Clerk ID)
 */
export async function getProfileByUserId(userId: string): Promise<Profile | null> {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile by user_id:', error);
    return null;
  }

  return data;
}

/**
 * Update a user's profile
 * Only updates fields that are provided in the updates object
 */
export async function updateProfile(
  userId: string,
  updates: EditableProfile
): Promise<{ success: boolean; profile?: Profile; error?: string }> {
  const supabase = createClient();

  // Validate username format if provided
  if (updates.username) {
    const isValid = validateUsername(updates.username);
    if (!isValid) {
      return {
        success: false,
        error: 'Username can only contain letters, numbers, and underscores (3-20 characters)'
      };
    }

    // Check if username is already taken
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('username', updates.username)
      .single();

    if (existingProfile && existingProfile.user_id !== userId) {
      return {
        success: false,
        error: 'Username is already taken'
      };
    }
  }

  // Validate website URL if provided
  if (updates.website && updates.website.trim() !== '') {
    const isValid = validateWebsiteUrl(updates.website);
    if (!isValid) {
      return {
        success: false,
        error: 'Website must be a valid URL'
      };
    }
  }

  // Perform the update
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating profile:', error);
    return {
      success: false,
      error: error.message
    };
  }

  return {
    success: true,
    profile: data
  };
}

/**
 * Validate username format
 * Rules: 3-20 characters, letters, numbers, underscores only
 */
export function validateUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
}

/**
 * Validate website URL
 */
export function validateWebsiteUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Format user's join date
 * Example: "Joined March 2024"
 */
export function formatJoinDate(dateString: string): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
  return `Joined ${date.toLocaleDateString('en-US', options)}`;
}

/**
 * Format large numbers with K/M suffixes
 * Examples: 1234 -> 1.2K, 1500000 -> 1.5M
 */
export function formatCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 1000000) return `${(count / 1000).toFixed(1)}K`;
  return `${(count / 1000000).toFixed(1)}M`;
}

/**
 * Sync current user to Supabase profiles table
 * Should be called after login or when needed
 */
export async function syncCurrentUser(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/sync-user', {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error || 'Failed to sync user'
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error syncing user:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Upload profile banner image to Supabase Storage
 */
export async function uploadBannerImage(file: File, userId: string): Promise<string | null> {
  const supabase = createClient();

  // Validate file type
  if (!file.type.startsWith('image/')) {
    console.error('File must be an image');
    return null;
  }

  // Validate file size (max 5MB)
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_SIZE) {
    console.error('File size must be less than 5MB');
    return null;
  }

  // Generate unique filename
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}-${Date.now()}.${fileExt}`;
  const filePath = `profile-banners/${fileName}`;

  try {
    const { data, error } = await supabase.storage
      .from('posts') // Reusing the posts bucket
      .upload(filePath, file);

    if (error) {
      console.error('Error uploading banner:', error);
      return null;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('posts')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading banner:', error);
    return null;
  }
}

/**
 * Search for profiles by username or full name
 */
export async function searchProfiles(query: string, limit: number = 10): Promise<Profile[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
    .limit(limit);

  if (error) {
    console.error('Error searching profiles:', error);
    return [];
  }

  return data || [];
}

/**
 * Get multiple profiles by user IDs
 * Useful for showing post authors in bulk
 */
export async function getProfilesByUserIds(userIds: string[]): Promise<Map<string, Profile>> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in('user_id', userIds);

  if (error) {
    console.error('Error fetching profiles:', error);
    return new Map();
  }

  // Convert array to Map for easy lookup
  const profilesMap = new Map<string, Profile>();
  data?.forEach(profile => {
    profilesMap.set(profile.user_id, profile);
  });

  return profilesMap;
}

