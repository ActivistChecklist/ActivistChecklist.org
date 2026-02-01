import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { useAnalytics } from '@/hooks/use-analytics';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { Alert } from '@/components/ui/alert';
import { MAX_CHARS, RESPONSE_OPTIONS, formSchema } from './contactFormSchema';

const ContactForm = ({ 
  successMessage = 'Message sent successfully!',
  context = 'default'
}) => {
  const [status, setStatus] = useState({ type: '', message: '' });
  const [showForm, setShowForm] = useState(true);
  const { trackEvent } = useAnalytics();

  const form = useForm({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: {
      message: "",
      responseType: "none",
      email: "",
      signalUsername: "",
      signalPhone: "",
    },
  });

  const { isSubmitting } = form.formState;
  const messageLength = form.watch("message")?.length || 0;
  const remainingChars = MAX_CHARS - messageLength;
  const responseType = form.watch("responseType");

  const resetForm = () => {
    form.reset();
    setStatus({ type: '', message: '' });
    setShowForm(true);
  };

  const onSubmit = async (data) => {
    setStatus({ type: '', message: '' });

    try {
      if (typeof window !== 'undefined') {
        trackEvent({
          name: 'contact_form_submitted',
          data: {
            context,
            response_type: data.responseType,
          }
        });
      }

      const response = await fetch('/api-server/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      const responseData = await response.json();

      if (response.ok) {
        setStatus({ type: 'success', message: successMessage });
        form.reset();
        setShowForm(false);
      } else {
        throw new Error(responseData.message || 'Failed to send message');
      }
    } catch (error) {
      console.error(error);
      setStatus({ 
        type: 'error', 
        message: 'Failed to send message. Please try again later.'
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {status.message && (
        <Alert 
          variant={status.type === 'success' ? 'success' : 'error'}
          className="mb-4"
        >
          <div>
            <p>
              {status.message}
            </p>
          </div>
        </Alert>
      )}

      {showForm && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Message</FormLabel>
                  <FormControl>
                    <textarea
                      {...field}
                      onBlur={field.onBlur}
                      rows={6}
                      className={cn(
                        "w-full p-3 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                        "ring-offset-background",
                        "placeholder:text-muted-foreground",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        form.formState.errors.message && [
                          "border-destructive",
                          "focus-visible:ring-destructive",
                        ]
                      )}
                      placeholder="Enter your message..."
                    />
                  </FormControl>
                  {remainingChars <= 500 && (
                    <FormDescription className="text-red-500">
                      {remainingChars} characters remaining
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="responseType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Would you like a response?</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col space-y-1"
                    >
                      {RESPONSE_OPTIONS.map((option, index) => (
                        <div key={option.value} className="flex items-center space-x-2">
                          <RadioGroupItem value={option.value} id={`r${index + 1}`} />
                          <label
                            htmlFor={`r${index + 1}`}
                            className={cn(
                              "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
                              "flex items-center gap-2"
                            )}
                          >
                            {option.label}
                            {option.recommended && (
                              <Badge variant="default">{option.recommended}</Badge>
                            )}
                          </label>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {responseType === 'email' && (
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter your email address" 
                        {...field}
                        onBlur={field.onBlur}
                        className={cn(
                          form.formState.errors.email && [
                            "border-destructive",
                            "focus-visible:ring-destructive",
                          ]
                        )}
                      />
                    </FormControl>
                    <FormDescription>
                      Note on email replies: Unless you use Proton Mail, your email provider can read any replies we send to your message.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {responseType === 'signal_username' && (
              <FormField
                control={form.control}
                name="signalUsername"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Signal Username</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          placeholder="username.12"
                          {...field}
                          onBlur={field.onBlur}
                          onChange={(e) => {
                            // Remove @ symbol
                            const cleanedValue = e.target.value.replace(/@/g, '');
                            field.onChange(cleanedValue);
                          }}
                          className={cn(
                            "pl-7",
                            form.formState.errors.signalUsername && [
                              "border-destructive",
                              "focus-visible:ring-destructive",
                            ]
                          )}
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">@</span>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Example: <code>@snowden.04</code> — Your username is different than your display name. Find your username at {'Signal > User Icon (top right) > Settings. It will be listed near the top, just underneath your phone number.'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {responseType === 'signal_phone' && (
              <FormField
                control={form.control}
                name="signalPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Signal Phone Number</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter your Signal phone number" 
                        {...field}
                        onBlur={field.onBlur}
                        className={cn(
                          form.formState.errors.signalPhone && [
                            "border-destructive",
                            "focus-visible:ring-destructive",
                          ]
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Button
              type="submit"
              disabled={isSubmitting || !form.formState.isValid}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Message'
              )}
            </Button>
            <div className="mb-8 text-sm text-muted-foreground">
              <p>
                <b>Privacy:</b> Your message is securely encrypted and sent to our Proton Mail account. We don't collect any personal information about you.
              </p>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
};

export default ContactForm; 