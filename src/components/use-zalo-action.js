import { useSnackbar } from "zmp-ui";

/** Bắt lỗi SDK để thao tác bị từ chối không trở thành unhandled rejection. */
export function useZaloAction() {
  const { openSnackbar } = useSnackbar();
  return async (action) => {
    try { await action(); }
    catch (error) {
      const msg = String(error?.message || "");
      if (error?.code === -201 || /user rejected|cancel/i.test(msg)) {
        return;
      }
      openSnackbar({ text: msg || "Chưa thực hiện được thao tác. Vui lòng thử lại trong Zalo.", type: "error" });
    }
  };
}
