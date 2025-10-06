import { type Metadata } from 'next'
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Bato - Social Platform',
  description: 'Share your thoughts with the world',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 sticky top-0 z-50">
            <div className="max-w-6xl mx-auto px-4">
              <div className="flex justify-between items-center h-16">
                {/* Logo/Brand */}
                <Link href="/" className="font-bold text-xl text-blue-600">
                  Bato
                </Link>
                
                {/* Navigation - Only show when signed in */}
                <SignedIn>
                  <nav className="flex space-x-6">
                    <Link 
                      href="/" 
                      className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 font-medium transition-colors"
                    >
                      Home
                    </Link>
                    <Link 
                      href="/for-you" 
                      className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 font-medium transition-colors"
                    >
                      For You
                    </Link>
                    <Link 
                      href="/post" 
                      className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 font-medium transition-colors"
                    >
                      Post
                    </Link>
                  </nav>
                </SignedIn>

                {/* Auth buttons */}
                <div className="flex items-center gap-4">
                  <SignedOut>
                    <SignInButton />
                    <SignUpButton>
                      <button className="bg-[#6c47ff] text-white rounded-full font-medium text-sm h-10 px-5 cursor-pointer hover:bg-[#5a3dd9] transition-colors">
                        Sign Up
                      </button>
                    </SignUpButton>
                  </SignedOut>
                  <SignedIn>
                    <UserButton />
                  </SignedIn>
                </div>
              </div>
            </div>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}