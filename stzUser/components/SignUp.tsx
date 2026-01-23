import * as v from 'valibot'
import { type SyntheticEvent, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { signUp, sendVerificationEmail } from '~stzUser/lib/auth-client'
import { FormFieldError } from '~stzUtils/components/FormFieldError';
import { PasswordInput } from '~stzUtils/components/InputFields';
import { fieldsFromFormData } from "~stzUser/lib/form";
import { Spacer } from "~stzUtils/components/Spacer";
import { requiredPasswordValidation } from '~stzUser/lib/password-validation';
import { clientEnv } from '~stzUser/lib/env';
import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile: any;
  }
}

// exported for the E2E signup test
export const accountCreatedText = {
  announce: "We've sent an email-confirmation link to",
  instruction: "Please check your email inbox and follow the instructions"
}

// TypeScript - sugggested by Valibot docs, and comes in handy later
type SignupData = {
  email: string;
  password: string;
  name?: string;
};

// Valibot
const SignupSchema = v.object({
  email: v.pipe(
    v.string('email must be a string'),
    v.nonEmpty('email address required'),
    v.email('invalid email'),
  ),
  password: requiredPasswordValidation,
  name: v.string(),
});

export const SignUp = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [success, setSuccess] = useState(false)

  const [validationIssues, setValidationIssues] = useState<any>({})
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    document.head.appendChild(script)

    script.onload = () => {
      if (window.turnstile && turnstileRef.current) {
        window.turnstile.render(turnstileRef.current, {
          sitekey: clientEnv.TURNSTILE_SITE_KEY,
          callback: (token: string) => {
            setTurnstileToken(token)
          },
        })
      }
    }

    return () => {
      const existingScript = document.querySelector('script[src*="turnstile/v0/api.js"]')
      if (existingScript) document.head.removeChild(existingScript)
    }
  }, [])

  const validateFormFields = (fields: SignupData) => {
    let isValid = true;

    try {
      const valibotResult = v.parse(
        SignupSchema,
        fields,
        { abortPipeEarly: true } // ensures each key, e.g. email, has only one error message
      )
      console.log('signup call to signUp.email()\n', { valibotResult })
    } catch (error: any) {/*: ValiError<typeof SignupSchema>*/
      const flattenedIssues = v.flatten<typeof SignupSchema>(error.issues)
      setValidationIssues(flattenedIssues?.nested ?? {})
      isValid = false
    }

    return isValid
  }

  const doSignUp = async (fields: SignupData) => {
    // console.log('doSignup - call to signUp.email()\n', {fields})
    const {
      // data,
      error
    } = await signUp.email(
      {
        email: fields.email,
        password: fields.password,
        name: fields.name || '',
        callbackURL: '',
        // SJS image: image ? convertImageToBase64(image) : undefined,
        // image: undefined,
      },
      {
        headers: {
          'x-turnstile-token': turnstileToken || '',
        },
        onRequest: (ctx) => {
          console.log('signup.email - onRequest', { ctx })
        },
        onSuccess: async (ctx) => {
          console.log('signup.email - onSuccess', { ctx })
          setSuccess(true)

          // WORKAROUND: Manually send verification email since sendOnSignUp is disabled due to bug
          // See: https://github.com/better-auth/better-auth/issues/2538
          try {
            await sendVerificationEmail({
              email: fields.email,
              callbackURL: '/'
            })
            console.log('Manual verification email sent successfully')
          } catch (error) {
            console.error('Error sending verification email:', error)
          }
          // window.location.href = routeStrings.signin
        },
        onError: (ctx) => {
          console.log('signup.email - onError', { ctxError: ctx.error.message })
        },
      },
    )
    if (error) {
      // I've seen this happen if a user already exists
      alert(error.message)
      console.log({ error })
    }
  }

  const handleSignUp = (event: SyntheticEvent<HTMLFormElement>) => {
    // prevent default form submission behavior
    event.preventDefault();
    event.stopPropagation();
    const formData = new FormData(event.currentTarget);
    const fields = fieldsFromFormData(formData)
    setEmail(fields.email as string)

    console.log('handleSignUp', { fields })
    const isValid = validateFormFields(fields as SignupData)
    console.log('handleSignUp', { isValid })

    if (isValid) doSignUp(fields as SignupData)
  }

  return (
    <section>
      {!success ?
        <form onSubmit={handleSignUp}>
          <label>Email
            <input
              name="email"
              type="email"
              defaultValue={''}
              autoComplete="on"
            />
            <FormFieldError message={validationIssues?.email} />
          </label>
          <label>Name
            <input
              name="name"
              type="name"
              defaultValue={''}
              autoComplete="on"
            />
          </label>
          <PasswordInput
            validationIssue={validationIssues?.password}
          />
          <div
            ref={turnstileRef}
            style={{ marginBottom: '1rem' }}
          />
          <button
            type="submit"
            disabled={!turnstileToken}
            title={!turnstileToken ? "Please complete the bot check" : ""}
          >
            Sign Up
          </button>
        </form>
        :
        <form>
          <h1>Account Created</h1>
          <p>We've sent an email-confirmation link to</p>
          <p style={{ marginLeft: '4rem' }}>{email}</p>
          <p>Please check your email inbox and follow the instructions</p>
          <Spacer space={3} />
          <div style={{ textAlign: "right" }}>
            <button
              type="submit"
              onClick={() => navigate({ to: "/" })}
            >
              Ok
            </button>
          </div>
        </form>
      }
    </section>
  )
}