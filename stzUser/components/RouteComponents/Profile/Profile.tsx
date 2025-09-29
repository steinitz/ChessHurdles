import {useNavigate} from "@tanstack/react-router";
import {MouseEvent, SyntheticEvent, useEffect, useState} from "react";
import * as v from "valibot";
import {niceValidationIssues, preventDefaultFormSubmission, sharedFormSubmission} from "~stzUser/lib/form";
import {changeEmail, changePassword, deleteUser, useSession} from "~stzUser/lib/auth-client";
import {Spacer} from "~stzUtils/components/Spacer";
import {EmailInput, PasswordInput} from "~stzUtils/components/InputFields";
import {
  DeleteAccountConfirmationDialog,
} from "./deleteAccountConfirmationDialog";
import {
  CheckForEmailChangeConfirmationLinkDialog,
} from "./checkForEmailChangeConfirmationLinkDialog";
import {SignIn} from "~stzUser/components/RouteComponents/SignIn";
import {makeDialogRef} from "~stzUtils/components/Dialog";
import Spinner from "~stzUser/components/Other/Spinner";
import {CheckForNewEmailVerificationLinkDialog} from "./checkForNewEmailVerificationLinkDialog";
import {routeStrings} from "~/constants";
import { passwordValidation, currentPasswordValidation } from '~stzUser/lib/password-validation';

const didConfirmChangeSearchParam = 'didConfirmChange'

// Test IDs - raw identifiers used in component data-testid attributes
export const profileTestIds = {
  profileForm: 'profile-form',
  saveChangesButton: 'save-changes-button'
} as const;

// Structural selectors - DOM-based selectors that can't be test IDs
export const profileStructuralSelectors = {
  emailInput: 'input[type="email"]',
  currentPasswordInput: 'input[name="currentPassword"]',
  newPasswordInput: 'input[name="newPassword"]',
  spinnerContainer: '.spinner'
} as const;

export const profileStrings = {
  passwordChangeSuccess: 'Password changed',
  passwordChangeError: 'Error changing password',
  currentPasswordLabel: 'Current password',
  newPasswordLabel: 'New password',
}

type ProfileData = {
  email: string
  currentPassword?: string
  newPassword?: string
}

// Valibot - using shared password validation
const ProfileSchema = v.object({
  email: v.pipe(
    v.string('email must be a string'),
    v.nonEmpty('email address required'),
    v.email('invalid email'),
  ),
  currentPassword: v.optional(currentPasswordValidation),
  newPassword: v.optional(passwordValidation),
})

export const Profile = () => {
  const {data: session} = useSession()
  const navigate = useNavigate()

  const checkForEmailChangeLinkConfirmationDialogRef = makeDialogRef();
  const checkForNewEmailVerificationLinkDialogRef = makeDialogRef();
  const deleteAccountConfirmationDialogRef = makeDialogRef();

  const email = session?.user?.email

  const [, setEmailChangeError] = useState<any>()
  const [, setNewEmailAddress] = useState('')
  const [shouldShowEmailChangeSpinner, setShouldShowEmailChangeSpinner] = useState(false)
  const [shouldShowPasswordChangeSpinner, setShouldShowPasswordChangeSpinner] = useState(false)

  const [validationIssues, setValidationIssues] = useState<any>({})
  const validateFormFields = (fields: ProfileData) => {
    const valibotResult = v.safeParse(
      ProfileSchema,
      fields,
      {abortPipeEarly: true} // max one issue per key
    )
    if (!valibotResult.success) {
      setValidationIssues(niceValidationIssues(valibotResult))
    }
    return valibotResult.success
  }

  const profileFormId = 'profileForm'

  const resetForm = () => {
    const profileForm = document.getElementById(profileFormId) as HTMLFormElement
    profileForm.reset();
  }
      
  const handleSaveChanges = async (
    event: SyntheticEvent<HTMLFormElement>,
  ) => {
    const fields = sharedFormSubmission(event)
    const newEmail = fields.email as string
    const currentPasswordValue = fields.currentPassword as string
    const newPasswordValue = fields.newPassword as string
    const isValid = validateFormFields(fields as ProfileData)

    if (isValid) {
      // Prevent simultaneous email and password changes
      const isEmailChange = fields.email !== email
      const isPasswordChange = newPasswordValue && newPasswordValue.trim() !== '' && currentPasswordValue && currentPasswordValue.trim() !== ''
      
      if (isEmailChange && isPasswordChange) {
        alert('You can change either email or password — one at a time.')
        return
      }

      // Handle password change
      if (isPasswordChange) {
        setShouldShowPasswordChangeSpinner(true)
        try {
          const { data, error } = await changePassword({
            newPassword: newPasswordValue,
            currentPassword: currentPasswordValue,
            revokeOtherSessions: true
          })
          if (data && !error) {
            alert(profileStrings.passwordChangeSuccess)
            resetForm()
             // Clear the password fields
          } 
          else {
            let alertMessage = error.message
            if (error.status === 400 && error.message === "Invalid password") {
              alertMessage = "You entered an incorrect Current Password.\nYou can signout and reset your password from the Sign In page";
            }
            alert(alertMessage)
          }
        } 
        catch (error: any) {
          alert(`${profileStrings.passwordChangeError}: ${error.message || 'Unknown error'}`)
        }
        setShouldShowPasswordChangeSpinner(false)
      }
      
      // Handle email change
      if (isEmailChange) {
        // note: BetterAuth supports email confirmation for changing email.
        setShouldShowEmailChangeSpinner(true)
        setNewEmailAddress((newEmail))
        
        let data, error;
        try {
          const result = await changeEmail({
            newEmail,
            // notes:

            // 1. logic in stzUser/lib/auth.ts currently uses this callbackURL 
            // component of the api URL to prevent sendVerificationEmail 
            // from sending a verification email to the old email address.  
            // Better Auth provides no clean way to disable this behavior.  
            // Github issue raised July 2025
            
            // 2. this redirect occurs after the user clicks the link in the email
            callbackURL: routeStrings.profile
          })
          data = result.data
          error = result.error
        } catch (e) {
          error = {message: `Network error: ${e?.message || 'Unknown error'}`}
          data = null
        }
        
        if (error) {
          alert('Error changing email address')
          setEmailChangeError(error.message as string)
        } 
        else {
          checkForEmailChangeLinkConfirmationDialogRef.current.setIsOpen(true)
        }
        
        setShouldShowEmailChangeSpinner(false)
      }
    }
  }
  // The comment below seems wrong - sendVerificationEmail email sending is disabled for change email...
  // TODO: Clarify and cleanup

  // COMMENTED OUT: No longer needed since sendChangeEmailVerification is disabled
  // The unified sendVerificationEmail handles email change verification directly
  // 
  // useEffect(() => {
  //   const didConfirmChange = new URLSearchParams(
  //     window.location.search
  //   ).get(didConfirmChangeSearchParam) || undefined
  //   // check that we're on the special profile?didConfirmChange=true page
  //   if (didConfirmChange) {
  //     console.log('useEffect1 - opening dialog')
  //     checkForNewEmailVerificationLinkDialogRef.current.setIsOpen(true)
  //   }
  // })

  function handleDeleteAccountRequest(event: MouseEvent<HTMLButtonElement>): void {
    console.log('handleDeleteAccountRequest', {deleteAccountConfirmationDialogRef})
    preventDefaultFormSubmission(event)
    deleteAccountConfirmationDialogRef.current.setIsOpen(true)
  }

  function handleDelete(): void {
    console.log('handleDelete - Account deletion successful')
    deleteAccountConfirmationDialogRef.current.setIsOpen(false)
    deleteUser()
      .then(() => {
        console.log('handleDelete - Account deletion successful')
      })
      .catch((error) => {
        console.error('handleDelete - Account deletion failed:', error)
        // Show the specific error message from the server
        const errorMessage = error instanceof Error ? error.message : 'Error deleting account'
        alert(errorMessage)
      })
  }

  return (
    <>
      <DeleteAccountConfirmationDialog
        ref={deleteAccountConfirmationDialogRef}
        onDelete={handleDelete}
      />
      <CheckForEmailChangeConfirmationLinkDialog
        ref={checkForEmailChangeLinkConfirmationDialogRef}
        onClick={() => navigate({to: routeStrings.profile})}
      />
      <CheckForNewEmailVerificationLinkDialog
        ref={checkForNewEmailVerificationLinkDialogRef}
        onClick={() => navigate({to: routeStrings.profile})}
      />
      <section>
        {session?.user ?
          <form
            data-testid={profileTestIds.profileForm}
            onSubmit={handleSaveChanges}
            id={profileFormId}
            // style={{maxWidth: '350px'}}
          >
            <div style={{display: "flex", flexDirection: "row", justifyContent: "flex-start"}}>
              <h1>Profile</h1>
              {(shouldShowEmailChangeSpinner || shouldShowPasswordChangeSpinner) && <div style={{margin: '1rem 5rem'}}><Spinner/></div>}
            </div>
            
            <p style={{marginTop: '0', color: 'var(--color-text-secondary)', fontSize: '0.9rem'}}>
              Update your email address or change your password.<br />
              Leave password fields empty to keep your current password.
            </p>
            
            <Spacer />

            <EmailInput
              validationErrors={validationIssues}
              defaultValue={email}
            />
            
            <Spacer />
            
            <PasswordInput
              fieldName="currentPassword"
              label="Current Password"
              autoComplete="current-password"
              validationIssue={validationIssues?.currentPassword}
            />
            
            <Spacer space={0}/>
            
            <PasswordInput
              fieldName="newPassword"
              label="New Password"
              autoComplete="new-password"
              validationIssue={validationIssues?.newPassword}
            />

            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between"
              }}
            >
              <button
                onClick={handleDeleteAccountRequest}
                style={{
                  backgroundColor: 'var(--color-error)',
                  borderColor: 'var(--color-error)'
                }}
              >
                Delete Account
              </button>
              <Spacer orientation="horizontal" space={1}/>
              <button
                data-testid={profileTestIds.saveChangesButton}
                type="submit"
              >
                Save Changes
              </button>
            </div>
          </form>
          :
          <>
            <h4
              style={{margin: '-1rem', fontWeight: 'normal'}}
            >
              Sign In to access your Profile
            </h4>
            <Spacer/>
            <SignIn/>
          </>
        }
      </section>
    </>
  )
}