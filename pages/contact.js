import Head from 'next/head';
import Layout from '@/components/layout/Layout';
import { Card, CardHeader, CardContent, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { IoLogoGithub, IoChatbubbleEllipsesOutline, IoKeyOutline } from "react-icons/io5";
import ContactForm from '@/components/forms/ContactForm';
import { ROUTES } from '@/config/routes'

const Contact = () => {
  return (
    <div>
      <Head>
        <title>Contact Us</title>
      </Head>
      <Layout>
        <div>
          <div>
            <section className="prose mb-12">
              <h1 className="page-title">Contact Us</h1>
              <p>
                Your feedback helps make this resource more useful and secure for everyone. We welcome suggestions for:
              </p>
              <ul>
                <li>Correcting any inaccuracies or outdated information</li>
                <li>Making our guides clearer and easier to understand</li>
                <li>Improving security recommendations</li>
                <li>Suggesting new topics we should cover</li>
              </ul>
            </section>

            <div className="mb-16">
              <div className="mb-6 flex items-baseline gap-2">
                <h2 className="">Send us a message</h2>
                <span className="text-sm text-muted-foreground">(recommended)</span>
              </div>
              <ContactForm 
                successMessage="Message sent successfully! We'll get back to you soon."
                context="contact_page"
              />
            </div>

            <div className="prose">
              <h2 className="mb-4" style={{ borderBottom: 'none' }}>Other ways to reach us</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <IoLogoGithub className="w-5 h-5" />
                    Public Feedback (GitHub)
                  </CardTitle>
                  <CardDescription>
                    If you're okay with sharing publicly, you can submit feedback, questions, and feature requests through our GitHub repository.
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <a 
                    href="https://github.com/ActivistChecklist/ActivistChecklist.org" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Visit GitHub Repository →
                  </a>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <IoChatbubbleEllipsesOutline className="w-5 h-5" />
                    Signal Group
                  </CardTitle>
                  <CardDescription>
                    Message us on Signal through our group chat. Though we regularly remove members, others may see your messages.
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <a 
                    href="https://signal.group/#CjQKIMHMICdIKIjWfy-r8XOlRy9CBBMw5KGe5J4z9DmMgVa2EhDh4H3OFQxL7Jj3phBq5Ttd" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Join Signal Group →
                  </a>
                </CardFooter>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <IoKeyOutline className="w-5 h-5" />
                    Encrypted Email
                  </CardTitle>
                  <CardDescription>
                    Using Proton Mail? Your messages will be automatically encrypted.
                    For other providers, you can use our PGP key.
                  </CardDescription>
                </CardHeader>
                <CardFooter className="flex-col items-start space-y-2">
                  <a 
                    href="mailto:contact@activistchecklist.org"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    contact@activistchecklist.org
                  </a>
                  <a 
                    href={ROUTES.PGP_KEY_FILE} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    View PGP Key →
                  </a>
                </CardFooter>
              </Card>
            </div>

          </div>
        </div>
      </Layout>
    </div>
  );
};

export default Contact;
