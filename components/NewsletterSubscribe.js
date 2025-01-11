'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/alert';

function useNewsletterSubscribe() {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const subscribe = async (email) => {
    setStatus('loading');
    setError('');

    try {
      const response = await fetch('/api-server/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus('success');
        return true;
      } else {
        setStatus('error');
        setError(result.error || 'Failed to subscribe. Please try again.');
        return false;
      }
    } catch (err) {
      setStatus('error');
      setError('Network error. Please try again.');
      return false;
    }
  };

  return {
    status,
    error,
    subscribe,
  };
}

export function NewsletterSubscribeForm({ onSuccess }) {
  const [email, setEmail] = useState('');
  const [showForm, setShowForm] = useState(true);
  const { status, error, subscribe } = useNewsletterSubscribe();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await subscribe(email);
    if (success) {
      setEmail('');
      onSuccess?.();
      setShowForm(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {status === 'error' && (
        <Alert 
          variant="error" 
          className="mb-4"
        >
          {error}
        </Alert>
      )}

      {status === 'success' && !showForm && (
        <Alert 
          variant="success" 
          className="mb-4"
        >
          You're subscribed! Want to message a friend on Signal to let them know about this project?
        </Alert>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={status === 'loading'}
              className="flex-1"
            />
            <Button 
              type="submit"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Subscribe'
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function CompactNewsletterSubscribe() {
  const [email, setEmail] = useState('');
  const [showForm, setShowForm] = useState(true);
  const { status, error, subscribe } = useNewsletterSubscribe();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = await subscribe(email);
    if (success) {
      setEmail('');
      setShowForm(false);
    }
  };

  return (
    <div className="space-y-2">
      {status === 'error' && (
        <Alert 
          variant="error" 
          className="text-sm"
        >
          {error}
        </Alert>
      )}

      {status === 'success' && !showForm && (
        <Alert 
          variant="success" 
          className="text-sm"
        >
          Thanks for subscribing!
        </Alert>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={status === 'loading'}
            className="max-w-xs"
          />
          <Button 
            type="submit"
            disabled={status === 'loading'}
          >
            {status === 'loading' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              '→'
            )}
          </Button>
        </form>
      )}
    </div>
  );
}

export default NewsletterSubscribeForm;
