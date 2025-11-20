import ChangePasswordForm from '../forms/ChangePasswordForm';
import DeleteAccountForm from '../forms/DeleteAccountForm';

const ProfilePage = () => {
  return (
    <div className="container mx-auto p-4 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100">Profile Settings</h1>
      <div className="space-y-8 w-full max-w-sm">
        <ChangePasswordForm />
        <DeleteAccountForm />
      </div>
    </div>
  );
};

export default ProfilePage;