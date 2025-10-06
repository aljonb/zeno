'use client'

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { 
  Profile, 
  getProfileByUserId, 
  updateProfile, 
  syncCurrentUser,
  validateUsername,
  validateWebsiteUrl,
  uploadBannerImage
} from '@/app/utils/profile';

/**
 * Edit Profile Page
 * Route: /settings/profile
 * 
 * Allows users to edit their profile information:
 * - Username
 * - Full name
 * - Bio
 * - Location
 * - Website
 * - Banner image
 */
export default function EditProfilePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const bannerInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    bio: '',
    location: '',
    website: '',
  });

  // Fetch current profile on mount
  useEffect(() => {
    if (isLoaded && user) {
      loadProfile();
    }
  }, [isLoaded, user]);

  const loadProfile = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      
      // First, sync user to ensure profile exists
      await syncCurrentUser();
      
      // Then fetch profile
      const profileData = await getProfileByUserId(user.id);
      
      if (profileData) {
        setProfile(profileData);
        setFormData({
          username: profileData.username || '',
          full_name: profileData.full_name || '',
          bio: profileData.bio || '',
          location: profileData.location || '',
          website: profileData.website || '',
        });
        setBannerPreview(profileData.banner_url);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setError('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError('Banner image must be less than 5MB');
      return;
    }

    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
    setError(null);
  };

  const removeBanner = () => {
    setBannerFile(null);
    setBannerPreview(null);
    if (bannerInputRef.current) {
      bannerInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to edit your profile');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Validate username
      if (formData.username && !validateUsername(formData.username)) {
        setError('Username can only contain letters, numbers, and underscores (3-20 characters)');
        setIsSaving(false);
        return;
      }

      // Validate website
      if (formData.website && formData.website.trim() !== '' && !validateWebsiteUrl(formData.website)) {
        setError('Please enter a valid website URL (e.g., https://example.com)');
        setIsSaving(false);
        return;
      }

      // Upload banner if changed
      let bannerUrl = profile?.banner_url || null;
      if (bannerFile) {
        const uploadedUrl = await uploadBannerImage(bannerFile, user.id);
        if (uploadedUrl) {
          bannerUrl = uploadedUrl;
        } else {
          setError('Failed to upload banner image');
          setIsSaving(false);
          return;
        }
      } else if (bannerPreview === null && profile?.banner_url) {
        // User removed the banner
        bannerUrl = null;
      }

      // Update profile
      const updateData = {
        ...formData,
        banner_url: bannerUrl || undefined,
      };

      const result = await updateProfile(user.id, updateData);

      if (result.success && result.profile) {
        setProfile(result.profile);
        setSuccess(true);
        setError(null);
        
        // Redirect to profile page after 1 second
        setTimeout(() => {
          router.push(`/profile/${result.profile?.username}`);
        }, 1000);
      } else {
        setError(result.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setError('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
          <h1 className="text-xl font-bold">Edit Profile</h1>
          <div className="w-16"></div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Banner Section */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="relative h-32 sm:h-48 bg-gradient-to-r from-blue-400 to-purple-500">
              {bannerPreview && (
                <img
                  src={bannerPreview}
                  alt="Profile banner"
                  className="w-full h-full object-cover"
                />
              )}
              
              {/* Banner Controls */}
              <div className="absolute inset-0 flex items-center justify-center space-x-2 bg-black bg-opacity-30">
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  className="bg-gray-900 bg-opacity-75 hover:bg-opacity-90 text-white p-2 rounded-full transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                {bannerPreview && (
                  <button
                    type="button"
                    onClick={removeBanner}
                    className="bg-gray-900 bg-opacity-75 hover:bg-opacity-90 text-white p-2 rounded-full transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/*"
                onChange={handleBannerSelect}
                className="hidden"
              />
            </div>
            
            {/* Avatar (read-only, managed by Clerk) */}
            <div className="px-4 pb-4">
              <img
                src={user.imageUrl}
                alt={user.fullName || user.username || 'User'}
                className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-900 -mt-12 shadow-lg"
              />
            </div>
          </div>

          {/* Form Fields */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-2">
                Username <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  required
                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your_username"
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                3-20 characters, letters, numbers, and underscores only
              </p>
            </div>

            {/* Full Name */}
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium mb-2">
                Full Name
              </label>
              <input
                type="text"
                id="full_name"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Your Name"
              />
            </div>

            {/* Bio */}
            <div>
              <label htmlFor="bio" className="block text-sm font-medium mb-2">
                Bio
              </label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleInputChange}
                rows={4}
                maxLength={160}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Tell us about yourself"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
                {formData.bio.length}/160
              </p>
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium mb-2">
                Location
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="San Francisco, CA"
              />
            </div>

            {/* Website */}
            <div>
              <label htmlFor="website" className="block text-sm font-medium mb-2">
                Website
              </label>
              <input
                type="url"
                id="website"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://example.com"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <p className="text-green-700 dark:text-green-400 text-sm">
                Profile updated successfully! Redirecting...
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSaving}
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-full transition-colors flex items-center justify-center space-x-2"
          >
            {isSaving && (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            )}
            <span>{isSaving ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

