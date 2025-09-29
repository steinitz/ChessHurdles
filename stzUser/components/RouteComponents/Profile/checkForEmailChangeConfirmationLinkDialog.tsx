import {Dialog, DialogRefType} from "~stzUtils/components/Dialog";

export const checkForEmailChangeConfirmationDialogText = "Check your email for a link to confirm your email-address change";

export const CheckForEmailChangeConfirmationLinkDialog = ({
  onClick,
  ref
}: {
  onClick: () => void,
  ref: DialogRefType
}) => {
  const handleClick = () => {
    ref.current?.setIsOpen(false);
    onClick?.();
  };

  return (
    <Dialog ref={ref}>
      <h3 style={{maxWidth: "17rem"}}>{checkForEmailChangeConfirmationDialogText}</h3>
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "flex-end"
        }}
      >
        <button
          type="submit"
          onClick={handleClick}
        >
          Ok
        </button>
      </div>
    </Dialog>
  );
};
