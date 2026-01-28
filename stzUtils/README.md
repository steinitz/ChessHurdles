# stzUtils

Shared utility components and functions that can be used across different parts of the application.

## Components

### Dialog
A reusable modal dialog component with TypeScript types.

**Props:**
- `ref: DialogRefType` - A ref created by `makeDialogRef()` to control the dialog
- `children: ReactNode` - Dialog content

**Usage:**
```tsx
import { Dialog, makeDialogRef } from '~stzUtils/components/Dialog'

const dialogRef = makeDialogRef()

// To open: dialogRef.current?.setIsOpen(true)
// To close: dialogRef.current?.setIsOpen(false)

<Dialog ref={dialogRef}>
  <p>Dialog content here</p>
</Dialog>
```

### ContactSent
A configurable confirmation component for contact forms.

**Props:**
- `email?: string` - Email address to display
- `onClose?: () => void` - Callback when component is closed

**Usage:**
```tsx
import { ContactSent } from '~stzUtils/components/ContactSent'

<ContactSent email="user@example.com" onClose={() => setShowConfirmation(false)} />
```

### FormFieldError
Displays form validation error messages with consistent styling.

**Props:**
- `message?: string` - Error message to display

**Usage:**
```tsx
import { FormFieldError } from '~stzUtils/components/FormFieldError'

<FormFieldError message={validationError} />
```

### InputFields
Collection of form input components with validation support.

**Components:**
- `EmailInput` - Email input field
- `PasswordInput` - Password input with show/hide toggle
- `UsernameInput` - Username input field
- `PreferredNameInput` - Preferred name input field
- `FullNameInput` - Full name input field
- `ValidatedInput` - Generic validated input component

**Usage:**
```tsx
import { EmailInput, PasswordInput, UsernameInput } from '~stzUtils/components/InputFields'

<EmailInput validationErrors={emailErrors} defaultValue="user@example.com" />
<PasswordInput validationIssue={passwordError} />
<UsernameInput validationErrors={usernameErrors} />
```

### PasswordInput
Password input field with show/hide toggle functionality.

**Props:**
- `validationIssue?: string` - Validation error message

**Usage:**
```tsx
import { PasswordInput } from '~stzUtils/components/PasswordInput'

<PasswordInput validationIssue={passwordError} />
```

### SignIn
Complete sign-in form component with validation.

**Usage:**
```tsx
import { SignIn } from '~stzUtils/components/SignIn'

<SignIn />
```

### SignUp
Complete sign-up form component with validation.

**Usage:**
```tsx
import { SignUp } from '~stzUtils/components/SignUp'

<SignUp />
```

### Spacer
Utility component for consistent vertical or horizontal spacing.

**Props:**
- `size?: number` - Size of the spacer (default: 16)
- `direction?: 'vertical' | 'horizontal'` - Direction of spacing (default: 'vertical')

**Usage:**
```tsx
import { Spacer } from '~stzUtils/components/Spacer'
// defaults: vertical orientation, space 1.5rem
<Spacer />

// custom space and direction 
<Spacer size={24} direction="horizontal" />
```

### Styles
Shared styling constants and CSS properties.

**Exports:**
- `hideFormBorder` - CSS properties to hide form borders
- `fieldLabelSubtext` - Styling for field label subtext
- `repurposedFormBoxStyle` - Form box styling
- `activeLinkStyle` - Active link styling

**Usage:**
```tsx
import { activeLinkStyle, fieldLabelSubtext } from '~stzUtils/components/styles'

<a style={activeLinkStyle}>Link</a>
<span style={fieldLabelSubtext}>Optional</span>
```

## Path Alias

Components in this directory can be imported using the `~stzUtils/` path alias:

```tsx
import {Dialog} from '~stzUtils/components/Dialog';
import {ContactSent} from '~stzUtils/components/ContactSent';
import {FormFieldError} from '~stzUtils/components/FormFieldError';
import {PasswordInput} from '~stzUtils/components/PasswordInput';
import {SignIn} from '~stzUtils/components/SignIn';
import {SignUp} from '~stzUtils/components/SignUp';
import {Spacer} from '~stzUtils/components/Spacer';
```

## Purpose

This directory contains:
- Shared UI components that are used across multiple features
- Utility functions that don't belong to a specific domain
- Components that provide common functionality for both authenticated and non-authenticated users

For user-specific authentication components, see the `stzUser/` directory.
For app-specific components, see the `src/components/` directory.