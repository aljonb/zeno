const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Diverse post templates with various topics
const postTemplates = [
  // Tech & Programming
  "Just discovered a new JavaScript feature that's going to change everything! 🚀",
  "Debugging for 3 hours only to find a missing semicolon. Classic Monday vibes 😅",
  "AI is fascinating, but nothing beats good old-fashioned problem-solving skills",
  "Hot take: Documentation is more important than clean code",
  "TypeScript has officially spoiled me. Going back to vanilla JS feels wrong",
  
  // Lifestyle & Personal
  "Morning coffee hits different when you've got a good playlist going ☕",
  "Tried meditation for the first time today. My brain is definitely not zen yet 🧘",
  "There's something magical about reading a physical book instead of a screen",
  "Cooking dinner from scratch tonight. Wish me luck! 👨‍🍳",
  "Weekend plans: absolutely nothing, and I'm excited about it",
  
  // Science & Learning
  "Fun fact: Octopuses have three hearts and blue blood! Nature is wild 🐙",
  "The James Webb telescope images never fail to blow my mind",
  "Learning about quantum physics makes me feel simultaneously smarter and more confused",
  "Did you know honey never spoils? Archaeologists have found edible honey in ancient tombs",
  "The human brain has about 86 billion neurons. That's more stars than in the Milky Way!",
  
  // Sports & Fitness
  "First 5K run in months. My legs are questioning my life choices 🏃‍♂️",
  "Basketball season is back! Time to dust off those sneakers",
  "Yoga class kicked my butt today, but I feel amazing",
  "Swimming is the most underrated full-body workout",
  "Chess is a sport, fight me ♟️",
  
  // Food & Culture
  "Tried sushi for the first time. I get the hype now! 🍣",
  "Homemade pizza will always beat delivery. The effort makes it taste better",
  "Coffee culture around the world is so diverse and fascinating",
  "Street food adventures are the best way to explore a new city",
  "Baking bread from scratch is therapeutic and rewarding",
  
  // Travel & Adventure
  "Missing those spontaneous road trips. Time to plan another adventure 🚗",
  "Mountain hiking teaches you patience and perseverance",
  "Beach sunsets never get old, no matter how many you've seen",
  "Local museums are hidden gems waiting to be discovered",
  "Traveling solo was scary at first, now it's liberating",
  
  // Art & Creativity
  "Spent the afternoon sketching. Art is the best form of meditation",
  "Music has the power to transport you to different worlds 🎵",
  "Photography teaches you to see beauty in everyday moments",
  "Writing is thinking made visible on paper",
  "Dance like nobody's watching, but also like everybody's watching and you're amazing",
  
  // Philosophy & Thoughts
  "Sometimes the best conversations happen in your own head",
  "Kindness is free, but its value is immeasurable",
  "Change is the only constant, yet we resist it the most",
  "Gratitude turns what we have into enough",
  "The journey matters more than the destination, but the destination gives direction",
  
  // Work & Career
  "Remote work has taught me the importance of setting boundaries",
  "Mentorship goes both ways. I learn as much as I teach",
  "Imposter syndrome is real, but so is your growth",
  "Networking is just making friends with a purpose",
  "Work-life balance isn't about perfect equilibrium, it's about conscious choices",
  
  // Environment & Nature
  "Spending time in nature is the best reset button for mental health 🌲",
  "Climate change isn't a future problem, it's happening now",
  "Urban gardening is my new obsession. Tomatoes on the balcony! 🍅",
  "Renewable energy innovations give me hope for the future",
  "Every small eco-friendly choice adds up to make a difference",
];

// Sample user profiles for variety
const sampleUsers = [
  {
    id: 'user_tech_alex',
    name: 'Alex Chen',
    email: 'alex.chen@example.com',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
  },
  {
    id: 'user_creative_sam',
    name: 'Sam Rivera',
    email: 'sam.rivera@example.com',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b1a0?w=150&h=150&fit=crop&crop=face'
  },
  {
    id: 'user_outdoors_jamie',
    name: 'Jamie Park',
    email: 'jamie.park@example.com',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face'
  },
  {
    id: 'user_foodie_taylor',
    name: 'Taylor Kim',
    email: 'taylor.kim@example.com',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
  },
  {
    id: 'user_student_morgan',
    name: 'Morgan Davis',
    email: 'morgan.davis@example.com',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
  }
];

function getRandomUser() {
  return sampleUsers[Math.floor(Math.random() * sampleUsers.length)];
}

function getRandomTemplate() {
  return postTemplates[Math.floor(Math.random() * postTemplates.length)];
}

function generateRandomTimestamp() {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * 30); // Random date within last 30 days
  const hoursAgo = Math.floor(Math.random() * 24);
  const minutesAgo = Math.floor(Math.random() * 60);
  
  return new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000) - (hoursAgo * 60 * 60 * 1000) - (minutesAgo * 60 * 1000));
}

async function generatePosts(count = 100) {
  console.log(`Generating ${count} posts...`);
  
  const posts = [];
  
  for (let i = 0; i < count; i++) {
    const user = getRandomUser();
    const content = getRandomTemplate();
    const timestamp = generateRandomTimestamp();
    
    posts.push({
      content,
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      user_avatar: user.avatar,
      image_urls: [], // Empty for now, can add random images later
      created_at: timestamp.toISOString(),
      updated_at: timestamp.toISOString()
    });
  }
  
  // Insert posts in batches of 10 to avoid rate limits
  const batchSize = 10;
  let inserted = 0;
  
  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize);
    
    const { data, error } = await supabase
      .from('posts')
      .insert(batch)
      .select();
    
    if (error) {
      console.error(`Error inserting batch ${Math.floor(i / batchSize) + 1}:`, error);
      break;
    }
    
    inserted += batch.length;
    console.log(`Inserted ${inserted}/${count} posts...`);
  }
  
  console.log(`✅ Successfully generated ${inserted} posts!`);
}

// Run the script
generatePosts(100).catch(console.error);