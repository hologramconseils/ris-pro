import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SignIn, SignUp } from '@clerk/clerk-react'
import { LABELS } from '../config/labels'

export default function Login() {
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const isSignup = searchParams.get('signup') === 'true'
  
  return (
    <div className="container flex items-center justify-center animate-fade-in" style={{ flex: 1, padding: '4rem 1.5rem' }}>
      <div className="w-full max-w-md flex justify-center">
        {isSignup ? (
          <SignUp 
            routing="virtual" 
            forceRedirectUrl={redirect} 
            signInUrl="/login"
            appearance={{
              elements: {
                card: "glass border-none shadow-none bg-transparent"
              }
            }}
          />
        ) : (
          <SignIn 
            routing="virtual" 
            forceRedirectUrl={redirect} 
            signUpUrl="/login?signup=true"
            appearance={{
              elements: {
                card: "glass border-none shadow-none bg-transparent"
              }
            }}
          />
        )}
      </div>
    </div>
  )
}
