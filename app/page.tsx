import Link from 'next/link'
import { SignedIn, SignedOut } from '@clerk/nextjs'
import { createClient } from './utils/supabase/server'

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
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diffInSeconds < 60) return 'now'
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`
  
  return date.toLocaleDateString()
}

function PostCard({ post }: { post: Post }) {
  // Fetch username from profiles table (if available)
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

export default async function Home() {
  const supabase = await createClient()
  
  // Fetch posts from the database, ordered by most recent first
  const { data: posts, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50) // Limit to 50 most recent posts

  if (error) {
    console.error('Error fetching posts:', error)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Welcome to Bato</h1>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Share your thoughts with the world
          </p>
        </div>

        {/* Post Button - Only show when signed in */}
        <SignedIn>
          <div className="flex justify-center mb-8">
            <Link
              href="/post"
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-8 rounded-full transition-colors flex items-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Create Post</span>
            </Link>
          </div>
        </SignedIn>

        {/* Sign in prompt for non-authenticated users */}
        <SignedOut>
          <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-xl">
            <h2 className="text-2xl font-semibold mb-4">Join the conversation</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Sign in to start sharing your thoughts and connect with others.
            </p>
          </div>
        </SignedOut>

        {/* Posts Feed */}
        <div className="space-y-4">
          <SignedIn>
            {posts && posts.length > 0 ? (
              <>
                <h2 className="text-2xl font-semibold mb-4">Recent Posts</h2>
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </>
            ) : (
              <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <h3 className="text-xl font-medium mb-2">No posts yet</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Be the first to share something with the community!
                </p>
              </div>
            )}
          </SignedIn>
        </div>
      </div>
    </div>
  )
}
