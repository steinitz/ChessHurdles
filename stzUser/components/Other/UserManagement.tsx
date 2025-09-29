import {useDeleteUserById, useSetUserRole, useDemoteUserToUserRole, useUpdateEmailVerificationStatus, type User} from '~stzUser/lib/users-client'
import {Spacer} from '~stzUtils/components/Spacer'
import {useState, useEffect, useMemo} from 'react'
import {admin, useSession} from '~stzUser/lib/auth-client'
import {userRoles, userRolesType} from '~stzUser/constants'
import {testConstants} from '~stzUser/test/constants'
import {useReactTable, getCoreRowModel, getSortedRowModel, createColumnHelper, flexRender} from '@tanstack/react-table'

// takes a database date and formats it as 5 Aug 25
const niceFormattedDate = (dateStringFromDB) => {
  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'short',
    year: '2-digit'
  }

  const date = new Date(dateStringFromDB)
  
  // 'en-US' for English (United States) locale, but 'au',
  // miraculously, gets the format I want: 5 Aug 25
  const formatter = new Intl.DateTimeFormat('au', options); 

  return formatter.format(date);
}

export function UserManagement({users}) {
  const {data: session} = useSession()
  const signedInUser = session?.user
  const signedInUserHasAdminRole = signedInUser?.role === userRoles.admin

  const [adminUsers, setAdminUsers] = useState<Set<string>>(new Set())
  const [sorting, setSorting] = useState([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const columnHelper = createColumnHelper<User>()

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
      try {
        await useDeleteUserById({data: userId})
        // Refresh the page to show updated user list
        window.location.reload()
      } catch (error) {
        console.error('Error deleting user:', error)
        // Show the specific error message from the server
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete user'
        alert(errorMessage)
      }
    }
  }

  const handleCleanTestUsers = async () => {
    const testUsers = users.filter(user => 
      // user.name === testConstants.defaultUserName && // this prevented deletion of certain test users
      (user.email.endsWith('@example.com') || user.email.endsWith(`@${testConstants.defaultUserDomain}`))
    )

    if (testUsers.length === 0) {
      alert('No test users found to delete.')
      return
    }

    if (confirm(`Are you sure you want to delete ${testUsers.length} test user(s)? This action cannot be undone.\n\nUsers to be deleted:\n${testUsers.map(u => `• ${u.name} (${u.email})`).join('\n')}`)) {
      try {
        // Delete users in sequence to avoid overwhelming the server
        for (const user of testUsers) {
          await useDeleteUserById({data: user.id})
        }
        // Refresh the page to show updated user list
        window.location.reload()
      } catch (error) {
        console.error('Error deleting test users:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete test users'
        alert(errorMessage)
      }
    }
  }

  const handleAdminToggle = async (userId: string) => {
    const newAdminUsers = new Set(adminUsers)
    const isCurrentlyAdmin = newAdminUsers.has(userId)

    try {
      if (isCurrentlyAdmin) {
        // Demote from admin to regular user
        await useDemoteUserToUserRole({data: {userId}})
        newAdminUsers.delete(userId)
      } else {
        // Add admin role
        await useSetUserRole({data: {userId, role: userRoles.admin as userRolesType}})
        newAdminUsers.add(userId)
      }

      setAdminUsers(newAdminUsers)
      console.log('Admin role updated for user:', userId, 'Is admin:', !isCurrentlyAdmin)
    } catch (error) {
      console.error('Error updating admin role:', error)
      alert('Failed to update admin role')
    }
  }

  const handleEmailVerificationToggle = async (userId: string) => {
    if (!selectedUser || selectedUser.id !== userId) return

    const newEmailVerified = !selectedUser.emailVerified

    try {
      await useUpdateEmailVerificationStatus({data: {userId, emailVerified: newEmailVerified}})

      // Update the selected user state to reflect the change immediately
      setSelectedUser({...selectedUser, emailVerified: newEmailVerified})

      console.log('Email verification status updated for user:', userId, 'Verified:', newEmailVerified)
    } catch (error) {
      console.error('Error updating email verification status:', error)
      alert('Failed to update email verification status')
    }
  }

  const copyUserId = (userId: string) => {
    navigator.clipboard.writeText(userId)
    alert('User ID copied to clipboard!')
  }

  // Load admin users on component mount
  useEffect(() => {
    const loadAdminUsers = async () => {
      try {
        const {data: usersData, error} = await admin.listUsers({
          query: {}
        })
        if (!error && usersData) {
          const usersList = Array.isArray(usersData) ? usersData : usersData.users || []
          const adminUserIds = new Set(
            usersList
              .filter(user => user.role === userRoles.admin)
              .map(user => user.id)
          )
          setAdminUsers(adminUserIds)
          console.log('Loaded admin users:', adminUserIds)
        }
      } catch (error) {
        console.error('Error loading admin users:', error)
      }
    }

    loadAdminUsers()
  }, [])

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Name',
      cell: info => <strong>{info.getValue() || 'No name'}</strong>,
      enableSorting: true,  // doesn't seem necessary
    }),
    columnHelper.accessor('email', {
      header: 'Email',
      cell: info => info.getValue(),
      enableSorting: true,  // doesn't seem necessary
    }),
    columnHelper.accessor('createdAt', {
      header: 'Joined',
      // cell: info => `${new Date(info.getValue()).toLocaleDateString('en-US')}`,
      cell: info => niceFormattedDate(info.getValue()),
      enableSorting: true,  // doesn't seem necessary
      sortingFn: (rowA, rowB) => {
        const dateA = new Date(rowA.getValue('createdAt'))
        const dateB = new Date(rowB.getValue('createdAt'))
        return dateA.getTime() - dateB.getTime()
      },
    }),
    columnHelper.accessor('emailVerified', {
      header: 'Status',
      cell: info => info.getValue() ? 'Verified' : 'Unverified',
      enableSorting: true, // doesn't seem necessary
      sortingFn: (rowA, rowB) => {
        const valueA = rowA.getValue('emailVerified')
        const valueB = rowB.getValue('emailVerified')
        return valueA === valueB ? 0 : valueA ? 1 : -1
      },
    }),
    ...(signedInUserHasAdminRole ? [
    // This could be a columnHelper.display but sorting
    // doesn't seem to get enabled for that column type
    // Other have reported this issue/bug since 2022.
    columnHelper.accessor('id', {
        id: 'role',
        header: 'Role',
        cell: ({row}) => {
          const user = row.original
          return (
            <div
              style={{
                color: (adminUsers.has(user.id) ?
                  'var(--color-text)' :
                  'var(--color-text-secondary)')
              }}
            >
              {adminUsers.has(user.id) ? userRoles.admin : userRoles.user}&nbsp;
              {adminUsers.has(user.id) ? '👑' : '👤'}
            </div>
          )
        },
        enableSorting: true,
        sortingFn: (rowA, rowB) => {
          // utility function to determine if user is an admin
          const isAdmin = (userId) => adminUsers.has(userId)

          // we just compare booleans
          const valueA = isAdmin(rowA.original.id)
          const valueB = isAdmin(rowB.original.id)

          // first sort will put admins at the top
          return  valueA === valueB ? 0 : 
                  valueA > valueB ? -1 : 1
        },
      })
    ] : []),
    columnHelper.display({
      id: 'userId',
      header: 'User ID',
      cell: ({row}) => {
        const user = row.original
        return (
          <div style={{fontSize: '12px', fontFamily: 'monospace'}}>
            <span
              onClick={() => copyUserId(user.id)}
              style={{cursor: 'pointer', textDecoration: 'underline', color: '#0066cc'}}
              title="Click to copy User ID"
            >
              ID: {user.id.substring(0, 8)}...
            </span>
          </div>
        )
      },
    }),

  ], [adminUsers, signedInUserHasAdminRole, handleAdminToggle, handleDeleteUser, copyUserId])

  // Create computed users data that incorporates selectedUser updates
  const tableData = useMemo(() => {
    if (!selectedUser) return users
    return users.map(user =>
      user.id === selectedUser.id ? selectedUser : user
    )
  }, [users, selectedUser])

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const checkboxAndLabelFlexStyle =  {
    display: 'flex', // don't need because mvc.css inlines
    alignItems: 'center', 
    width: '50px', // without this box and label are really wide
    marginLeft: '-20px',
    marginTop: '-13px', // why needed?
    

    // marginTop: '-10px' // can't get them verticallyl aligned without

    // failed tries:
    // paddingTop: '0', // no effect
    // paddingBottom: '0',  // no effect
    // textAlign: 'left', // causes typescript error
    // selfAlign: 'flex-start' // no effect
  }

  const checkboxStyle = {
    // margin: '0', 
    // no effect maxWidth: '8px',
    // padding: '0',
  }
  const checkboxLabelStyle = {
    whiteSpace: 'nowrap', 
    marginTop: '-12px' // aligns label and check box and packs the whole row tighter to match the other fields
    // margin: '0', 
    

    //marginTop: '5px',
  }

  const CheckboxAndLabel = (
    {
      selectedUser, 
      changeHandler,
      label,
      inputId,
    }
  ) => {
    return (
      <div 
        style={checkboxAndLabelFlexStyle}
      >
        <input
            style={checkboxStyle}
            type="checkbox"
            id={inputId}
            checked={selectedUser.emailVerified}
            onChange={() => changeHandler(selectedUser.id)}
        />
        <label 
          style={checkboxLabelStyle}
          htmlFor={inputId} 
        >
          {label}
        </label>
      </div>
    )
  }

  return (
    <main>
      <section>
        <div style={{display: 'flex', justifyContent: 'center', gap: '2rem'}}>
          <h3>Registered Users ({users.length})</h3>
          {signedInUserHasAdminRole && (
            <>
              <div style={{marginBottom: '1rem'}}>
                <button
                  type="button"
                  onClick={handleCleanTestUsers}
                  style={{
                    backgroundColor: "var(--color-warning, #ff9800)",
                    borderColor: "var(--color-warning, #ff9800)",
                    fontSize: '0.9rem',
                    padding: '0.5rem 1rem'
                  }}
                >
                  Clean Test Users
                </button>
              </div>
            </>
          )}
        </div>
        <Spacer space={0} />
        {users.length === 0 ? (
          <p>No users registered yet.</p>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', width: 'fit-content', margin: '0 auto'}}>
            <table style={{borderCollapse: 'collapse'}}>
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        style={{
                          padding: '8px',
                          textAlign: 'left',
                          borderBottom: '2px solid var(--color-border)',
                          fontWeight: 'bold',
                          cursor: header.column.getCanSort() ? 'pointer' : 'default',
                          userSelect: 'none',
                          transition: 'background-color 0.2s ease'
                        }}
                        onClick={header.column.getToggleSortingHandler()}
                        onMouseEnter={(e) => {
                          if (header.column.getCanSort()) {
                            e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary, #f5f5f5)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                      >
                        <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                          {header.column.getCanSort() && (
                            <span style={{
                              fontSize: '14px',
                              opacity: 0.6,
                              fontWeight: 'normal',
                              minWidth: '12px',
                              textAlign: 'center'
                            }}>
                              {{
                                asc: '↑',
                                desc: '↓',
                              }[header.column.getIsSorted() as string] ?? '↕'}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr
                    key={row.id}
                    onClick={signedInUserHasAdminRole ? () => {
                      const user = row.original
                      setSelectedUser(user)
                    } : undefined}
                    style={{
                      cursor: signedInUserHasAdminRole ? 'pointer' : 'default',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={signedInUserHasAdminRole ? (e) => {
                      e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'
                    } : undefined}
                    onMouseLeave={signedInUserHasAdminRole ? (e) => {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    } : undefined}
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        style={{
                          padding: '8px',
                          borderBottom: '1px solid var(--color-border)',
                          verticalAlign: 'top'
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedUser && (
          <>
            <Spacer />
            <section>
              <h3><span style={{fontWeight: 'normal'}}>Edit User &nbsp;</span>{selectedUser.name || selectedUser.email}</h3>
              <Spacer space={0} />

              <div 
                style={{
                  display: 'flex', 
                  flexDirection: 'column', 
                  // no effect: justifyContent: 'flex-start', 
                  // no effect: alignItems: 'flex-start', 
                  gap: '1rem'
                }}>
                <div>
                  <p><strong>Email:</strong> {selectedUser.email}</p>
                  <p><strong>ID:</strong> {selectedUser.id}</p>
                </div>

                {signedInUserHasAdminRole && (
                  <CheckboxAndLabel 
                    selectedUser={selectedUser} 
                    changeHandler={handleEmailVerificationToggle}
                    label={'Email Verified'}
                    inputId={'email-verified-checkbox'}
                  />
                )}

                {signedInUserHasAdminRole && (
                  <CheckboxAndLabel 
                    selectedUser={selectedUser} 
                    changeHandler={handleAdminToggle}
                    label={'Admin Role'}
                    inputId={'admin-role-checkbox'}
                  />
                )}

                <div style={{display: 'flex', justifyContent: 'stretch'}}>
                  {signedInUserHasAdminRole && (
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(selectedUser.id, selectedUser.name || selectedUser.email)}
                      style={{
                        backgroundColor: "var(--color-error)",
                        borderColor: "var(--color-error)"
                      }}
                    >
                      Delete User
                    </button>
                  )}
                  <Spacer orientation='horizontal' />
                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  )
}