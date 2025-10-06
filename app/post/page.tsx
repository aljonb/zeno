'use client'

import { useState, useRef, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { createClient } from '../utils/supabase/client'
import { syncCurrentUser } from '../utils/profile'

interface PostData {
  content: string
  images: File[]
  imageUrls: string[]
}

const MAX_CHARACTERS = 280
const MAX_IMAGES = 4

export default function PostPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [postData, setPostData] = useState<PostData>({
    content: '',
    images: [],
    imageUrls: []
  })
  const [isPosting, setIsPosting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [postData.content])

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value
    if (content.length <= MAX_CHARACTERS) {
      setPostData(prev => ({ ...prev, content }))
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const newImages = files.slice(0, MAX_IMAGES - postData.images.length)
    
    // Create preview URLs
    const newImageUrls = newImages.map(file => URL.createObjectURL(file))
    
    setPostData(prev => ({
      ...prev,
      images: [...prev.images, ...newImages],
      imageUrls: [...prev.imageUrls, ...newImageUrls]
    }))
  }

  const removeImage = (index: number) => {
    // Clean up object URL
    URL.revokeObjectURL(postData.imageUrls[index])
    
    setPostData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
      imageUrls: prev.imageUrls.filter((_, i) => i !== index)
    }))
  }

  const uploadImageToSupabase = async (file: File): Promise<string | null> => {
    const supabase = createClient()
    
    // Generate unique filename
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `post-images/${fileName}`

    try {
      const { data, error } = await supabase.storage
        .from('posts')
        .upload(filePath, file)

      if (error) {
        console.error('Error uploading image:', error)
        return null
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('posts')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      return null
    }
  }

  const handlePost = async () => {
    if (!postData.content.trim() && postData.images.length === 0) return
    if (!user) return
    
    setIsPosting(true)
    
    try {
      // Sync user to ensure profile exists in Supabase
      await syncCurrentUser();
      
      const supabase = createClient()
      
      // Upload images to Supabase Storage first
      const uploadedImageUrls: string[] = []
      
      if (postData.images.length > 0) {
        for (const image of postData.images) {
          const imageUrl = await uploadImageToSupabase(image)
          if (imageUrl) {
            uploadedImageUrls.push(imageUrl)
          }
        }
      }

      // Debug: Log what we're trying to insert
      const postToInsert = {
        content: postData.content.trim(),
        user_id: user.id,
        user_name: user.fullName || user.username || 'Anonymous',
        user_email: user.emailAddresses[0]?.emailAddress || '',
        user_avatar: user.imageUrl || '',
        image_urls: uploadedImageUrls,
      }
      
      console.log('Attempting to insert post:', postToInsert)

      // Insert post into database
      const { data, error } = await supabase
        .from('posts')
        .insert(postToInsert)
        .select()

      if (error) {
        console.error('Detailed error creating post:', {
          error,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        throw new Error(`Failed to create post: ${error.message}`)
      }

      console.log('Post created successfully:', data)

      // Reset form
      setPostData({ content: '', images: [], imageUrls: [] })
      postData.imageUrls.forEach(url => URL.revokeObjectURL(url))
      
      // Redirect to home or feed page
      router.push('/')
      
    } catch (error) {
      console.error('Error posting:', error)
      alert(`Failed to post: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsPosting(false)
    }
  }

  const isPostDisabled = (!postData.content.trim() && postData.images.length === 0) || isPosting
  const charactersRemaining = MAX_CHARACTERS - postData.content.length
  const isNearLimit = charactersRemaining <= 20
  const isOverLimit = charactersRemaining < 0

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
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
          <h1 className="text-xl font-bold">Create Post</h1>
          <div className="w-16"></div> {/* Spacer for center alignment */}
        </div>

        {/* User Info */}
        {user && (
          <div className="flex items-center mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <img
              src={user.imageUrl}
              alt={user.fullName || user.username || 'User'}
              className="w-10 h-10 rounded-full mr-3"
            />
            <div>
              <p className="font-medium text-sm">{user.fullName || user.username}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user.emailAddresses[0]?.emailAddress}
              </p>
            </div>
          </div>
        )}

        {/* Post Form */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          {/* Text Area */}
          <textarea
            ref={textareaRef}
            value={postData.content}
            onChange={handleContentChange}
            placeholder="What's happening?"
            className="w-full resize-none border-none outline-none text-lg placeholder-gray-500 dark:placeholder-gray-400 bg-transparent min-h-[120px] max-h-[300px]"
            rows={3}
          />

          {/* Image Preview Grid */}
          {postData.imageUrls.length > 0 && (
            <div className={`mt-4 grid gap-2 ${
              postData.imageUrls.length === 1 ? 'grid-cols-1' :
              postData.imageUrls.length === 2 ? 'grid-cols-2' :
              'grid-cols-2'
            }`}>
              {postData.imageUrls.map((url, index) => (
                <div key={index} className="relative group">
                  <img
                    src={url}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-2 right-2 bg-black bg-opacity-60 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center space-x-4">
              {/* Image Upload Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={postData.images.length >= MAX_IMAGES}
                className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              
              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />

              {/* Image Count */}
              {postData.images.length > 0 && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {postData.images.length}/{MAX_IMAGES}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-4">
              {/* Character Count */}
              <div className="flex items-center space-x-2">
                <div className={`text-sm font-medium ${
                  isOverLimit ? 'text-red-500' : 
                  isNearLimit ? 'text-yellow-500' : 
                  'text-gray-500 dark:text-gray-400'
                }`}>
                  {charactersRemaining}
                </div>
                <div className="w-8 h-8 relative">
                  <svg className="w-8 h-8 transform -rotate-90" viewBox="0 0 32 32">
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-gray-200 dark:text-gray-600"
                    />
                    <circle
                      cx="16"
                      cy="16"
                      r="14"
                      fill="none"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className={`transition-all duration-200 ${
                        isOverLimit ? 'stroke-red-500' : 
                        isNearLimit ? 'stroke-yellow-500' : 
                        'stroke-blue-500'
                      }`}
                      strokeDasharray={`${2 * Math.PI * 14}`}
                      strokeDashoffset={`${2 * Math.PI * 14 * (1 - Math.abs(postData.content.length) / MAX_CHARACTERS)}`}
                    />
                  </svg>
                </div>
              </div>

              {/* Post Button */}
              <button
                onClick={handlePost}
                disabled={isPostDisabled}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-6 rounded-full transition-colors flex items-center space-x-2"
              >
                {isPosting && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                <span>{isPosting ? 'Posting...' : 'Post'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Post Preview (when content exists) */}
        {(postData.content.trim() || postData.images.length > 0) && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Preview</h3>
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              {user && (
                <div className="flex items-start space-x-3">
                  <img
                    src={user.imageUrl}
                    alt={user.fullName || user.username || 'User'}
                    className="w-10 h-10 rounded-full flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="font-medium text-sm">{user.fullName || user.username}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">@{user.username}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">·</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">now</p>
                    </div>
                    {postData.content && (
                      <p className="mt-1 text-sm whitespace-pre-wrap">{postData.content}</p>
                    )}
                    {postData.imageUrls.length > 0 && (
                      <div className={`mt-3 grid gap-2 ${
                        postData.imageUrls.length === 1 ? 'grid-cols-1' :
                        postData.imageUrls.length === 2 ? 'grid-cols-2' :
                        'grid-cols-2'
                      }`}>
                        {postData.imageUrls.map((url, index) => (
                          <img
                            key={index}
                            src={url}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}