import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from '@/components/Link';
import { 
  FaGhost, FaArrowLeft, FaBullhorn, FaEye, FaShieldHalved, FaPeopleGroup, 
  FaFingerprint, FaHandFist, FaFire, FaCampground, FaWater
} from 'react-icons/fa6';
import { Sparkles } from 'lucide-react';
import Layout from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ROUTES } from '../config/routes'

// This is our custom 404 page that will be included in the static export
const VARIATIONS = [
  {
    icon: FaGhost,
    title: "Gone underground",
    message: "This page has disappeared! Maybe it's organizing something..."
  },
  {
    icon: FaEye,
    title: "Nothing to see here",
    message: "This page is practicing good OPSEC and staying off the grid."
  },
  {
    icon: FaPeopleGroup,
    title: "Solidarity forever",
    message: "The page you're looking for is out on the picket line."
  },
  {
    icon: FaShieldHalved,
    title: "Practicing good security culture",
    message: "This page is using end-to-end encryption... maybe a bit too well."
  },
  {
    icon: FaBullhorn,
    title: "Whose streets?",
    message: "Our streets! But this particular URL leads nowhere..."
  },
  {
    icon: FaFingerprint,
    title: "Identity protected",
    message: "This page is exercising its right to remain anonymous."
  },
  {
    icon: FaHandFist,
    title: "Direct action",
    message: "This page is out disrupting business as usual."
  },
  {
    icon: FaFire,
    title: "Fired up",
    message: "This page is busy lighting the spark of revolution."
  },
  {
    icon: FaCampground,
    title: "Mutual aid station",
    message: "This page has relocated to help distribute resources to the community."
  },
  {
    icon: FaWater,
    title: "Be water",
    message: "Like water, this page flows where it's needed most."
  }
];

export default function Custom404() {
  const [visual, setVisual] = useState(VARIATIONS[0]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setVisual(VARIATIONS[Math.floor(Math.random() * VARIATIONS.length)]);
  }, []);

  const Icon = visual.icon;

  const handleNewMessage = () => {
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * VARIATIONS.length);
    } while (VARIATIONS[newIndex].title === visual.title);
    setVisual(VARIATIONS[newIndex]);
  };

  return (
    <div>
      <Head>
        <title>404 - Page Not Found | Activist Checklist</title>
      </Head>
      <Layout sidebarType={null} searchable={false}>
        <div className="container max-w-2xl mx-auto px-4 py-16 text-center">
          <div className={cn(
            "mb-8 p-8 rounded-full w-32 h-32 mx-auto",
            "bg-gradient-to-br from-primary/20 via-accent/10 to-primary/20",
            "flex items-center justify-center",
            "group hover:scale-105 transition-transform duration-300",
            "hover:bg-primary/30",
            !mounted && "invisible"
          )}>
            <Icon className={cn(
              "w-16 h-16 text-primary",
              "group-hover:text-primary transition-colors duration-300"
            )} />
          </div>
          
          <div className={cn("space-y-2", !mounted && "invisible")}>
            <h3 className="text-2xl leading-tight font-semibold bg-gradient-to-br from-primary via-primary to-primary/70 bg-clip-text text-transparent">
              Oops! This page doesn't exist
            </h3>
            <h1 className="text-4xl leading-tight font-bold bg-gradient-to-br from-primary via-primary to-primary/70 bg-clip-text text-transparent">
              {visual.title}
            </h1>
          </div>
          
          <p className={cn("text-xl text-muted-foreground mt-4 mb-8", !mounted && "invisible")}>
            {visual.message}
          </p>

          <div className={cn("flex justify-center items-center relative", !mounted && "invisible")}>
            <Button asChild variant="default" size="lg" className="group">
              <Link href={ROUTES.HOME}>
                <FaArrowLeft className="mr-2 transition-transform duration-300 ease-out group-hover:-translate-x-1" />
                Back to Home
              </Link>
            </Button>
            
            <Button
              variant="ghost"
              size="xl"
              onClick={handleNewMessage}
              className={cn(
                "opacity-20 hover:opacity-90 transition-opacity duration-300",
                "hover:bg-transparent",
                "group",
                "absolute md:-right-16 -right-8"
              )}
              title="Try your luck?"
            >
              <Sparkles className={cn(
                "w-7 h-7 transition-all duration-500",
                "group-hover:rotate-12 group-hover:scale-[2.0]",
                "group-hover:animate-rainbow-shift"
              )} />
              <span className="sr-only">Show another random "missing page" message</span>
            </Button>
          </div>
        </div>
      </Layout>
    </div>
  );
}

// Add getStaticProps to ensure this page is included in the static export
export async function getStaticProps() {
  return {
    props: {}, // will be passed to the page component as props
  }
} 