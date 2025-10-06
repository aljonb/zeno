'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../utils/supabase/client'
import { SignedIn, SignedOut } from '@clerk/nextjs'
import Link from 'next/link'

interface Post {
  id: string
  content: string
  user_id: string
  user_name: string
  user_email: string
  user_avatar: string
  image_urls: string[]
  created_at: string
  updated_at: string
  similarity?: number // Similarity score from semantic search
}

interface FilterPreferences {
  includeKeywords: string[]
  excludeKeywords: string[]
  days: number
}

export default function ForYouPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [preferences, setPreferences] = useState<FilterPreferences>({
    includeKeywords: [],
    excludeKeywords: [],
    days: 7
  })

  // Parse natural language input
  const parseSearchInput = (input: string): FilterPreferences => {
    const lowercaseInput = input.toLowerCase()
    
    // Extract include keywords (what they want to see)
    const includePatterns = [
      /(?:want to see|show me|interested in|about|posts about)\s+([^,]+?)(?:\s*,|\s*and|\s*but|\s*i don't|$)/g,
      /(?:^|\s)([a-zA-Z]+(?:\s+[a-zA-Z]+)*?)(?:\s+posts|\s+content|\s*,|\s*and|\s*but|\s*i don't|$)/g
    ]
    
    // Extract exclude keywords (what they don't want to see)
    const excludePatterns = [
      /(?:don't want|no|not|exclude|avoid|hide)\s+(?:to see\s+)?(?:posts about\s+)?([^,]+?)(?:\s*,|\s*and|$)/g,
      /(?:i don't want)\s+(?:to see\s+)?(?:posts about\s+)?([^,]+?)(?:\s*,|\s*and|$)/g
    ]
    
    // Extract time period
    const timePatterns = [
      /(?:for|past|last)\s+(\d+)\s+(day|days|week|weeks|month|months)/g,
      /(\d+)\s+(day|days|week|weeks|month|months)/g
    ]
    
    const includeKeywords: string[] = []
    const excludeKeywords: string[] = []
    let days = 7 // default
    
    // Extract include keywords
    includePatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(lowercaseInput)) !== null) {
        const keywords = match[1].trim()
          .replace(/posts about|about/g, '')
          .split(/\s+and\s+|\s*,\s*/)
          .map(k => k.trim())
          .filter(k => k.length > 2)
        includeKeywords.push(...keywords)
      }
    })
    
    // Extract exclude keywords
    excludePatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(lowercaseInput)) !== null) {
        const keywords = match[1].trim()
          .replace(/posts about|about/g, '')
          .split(/\s+and\s+|\s*,\s*/)
          .map(k => k.trim())
          .filter(k => k.length > 2)
        excludeKeywords.push(...keywords)
      }
    })
    
    // Extract time period
    const timeMatch = timePatterns[0].exec(lowercaseInput)
    if (timeMatch) {
      const num = parseInt(timeMatch[1])
      const unit = timeMatch[2]
      if (unit.startsWith('week')) {
        days = num * 7
      } else if (unit.startsWith('month')) {
        days = num * 30
      } else {
        days = num
      }
    }
    
    return {
      includeKeywords: [...new Set(includeKeywords)], // remove duplicates
      excludeKeywords: [...new Set(excludeKeywords)],
      days: Math.min(days, 365) // cap at 1 year
    }
  }

  // Filter posts based on preferences
  const filterPosts = (allPosts: Post[], prefs: FilterPreferences) => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - prefs.days)
    
    return allPosts.filter(post => {
      // Check date range
      if (new Date(post.created_at) < cutoffDate) return false
      
      const content = post.content.toLowerCase()
      
      // Check exclude keywords (if any match, exclude the post)
      if (prefs.excludeKeywords.length > 0) {
        const hasExcluded = prefs.excludeKeywords.some(keyword => 
          content.includes(keyword)
        )
        if (hasExcluded) return false
      }
      
      // Check include keywords (if specified, at least one must match)
      if (prefs.includeKeywords.length > 0) {
        const hasIncluded = prefs.includeKeywords.some(keyword => 
          content.includes(keyword)
        )
        return hasIncluded
      }
      
      return true
    })
  }

  // Handle search with semantic search API
  const handleSearch = async () => {
    if (!searchInput.trim()) return
    
    setIsLoading(true)
    
    try {
      // Call semantic search API
      const response = await fetch('/api/search-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchInput,
          limit: 50,
          threshold: 0.25 // Adjust this to control match strictness (0-1)
        })
      });

      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }

      const { posts, cached } = await response.json();
      
      // Show cache indicator in console
      if (cached) {
        console.log('⚡ Used cached embedding (no API cost)');
      }
      
      setFilteredPosts(posts || []);
    } catch (error) {
      console.error('Error searching posts:', error);
      alert('Search failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <SignedIn>
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">For You</h1>
            <p className="text-gray-600 dark:text-gray-400 text-lg">
              Tell us what you want to see and we'll curate your perfect feed
            </p>
          </div>

          {/* Smart Search Bar */}
          <div className="mb-8">
            <div className="relative">
              <textarea
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Try: 'show me posts about renewable energy' or 'tech and programming posts' or 'food and cooking content'"
                className="w-full p-4 pr-12 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 resize-none min-h-[100px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
              <button
                onClick={handleSearch}
                disabled={!searchInput.trim() || isLoading}
                className="absolute bottom-4 right-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white p-2 rounded-lg transition-colors"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </button>
            </div>
            
            {/* Current Preferences Display */}
            {(preferences.includeKeywords.length > 0 || preferences.excludeKeywords.length > 0) && (
              <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-sm">
                  <div className="mb-2">
                    <strong>Showing posts from the past {preferences.days} days</strong>
                  </div>
                  {preferences.includeKeywords.length > 0 && (
                    <div className="mb-1">
                      <span className="text-green-600 dark:text-green-400">Including: </span>
                      {preferences.includeKeywords.map(keyword => (
                        <span key={keyword} className="inline-block bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded mr-2 text-xs">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                  {preferences.excludeKeywords.length > 0 && (
                    <div>
                      <span className="text-red-600 dark:text-red-400">Excluding: </span>
                      {preferences.excludeKeywords.map(keyword => (
                        <span key={keyword} className="inline-block bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded mr-2 text-xs">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Results */}
          <div className="space-y-4">
            {filteredPosts.length > 0 ? (
              <>
                <h2 className="text-2xl font-semibold mb-4">
                  {filteredPosts.length} posts match your preferences
                </h2>
                {filteredPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </>
            ) : searchInput && !isLoading ? (
              <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <h3 className="text-xl font-medium mb-2">No matching posts found</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Try adjusting your search criteria or expanding the time range
                </p>
              </div>
            ) : !searchInput ? (
              <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <h3 className="text-xl font-medium mb-2">Ready to curate your feed?</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Type what you want to see in natural language above
                </p>
              </div>
            ) : null}
          </div>
        </SignedIn>

        <SignedOut>
          <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <h2 className="text-2xl font-semibold mb-4">Sign in to customize your feed</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Create personalized content filters with natural language
            </p>
          </div>
        </SignedOut>
      </div>
    </div>
  )
}

// Reuse PostCard component from home page
function PostCard({ post }: { post: Post }) {
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return 'now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`
    
    return date.toLocaleDateString()
  }

  // Generate username for profile link
  const username = post.user_name?.toLowerCase().replace(/\s+/g, '_') || 'user';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start space-x-3">
        <Link href={`/profile/${username}`}>
          <img
            src={post.user_avatar || '/default-avatar.png'}
            alt={post.user_name}
            className="w-10 h-10 rounded-full flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <Link 
              href={`/profile/${username}`}
              className="font-medium text-sm hover:underline"
            >
              {post.user_name}
            </Link>
            <p className="text-xs text-gray-500 dark:text-gray-400">·</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatTimeAgo(post.created_at)}
            </p>
          </div>
          
          {post.content && (
            <p className="mt-1 text-sm whitespace-pre-wrap">{post.content}</p>
          )}
          
          {post.image_urls && post.image_urls.length > 0 && (
            <div className={`mt-3 grid gap-2 ${
              post.image_urls.length === 1 ? 'grid-cols-1' :
              post.image_urls.length === 2 ? 'grid-cols-2' :
              'grid-cols-2'
            }`}>
              {post.image_urls.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`Post image ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
