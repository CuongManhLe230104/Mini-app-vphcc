import { useSnackbar } from "zmp-ui";

/** Bắt lỗi SDK để thao tác bị từ chối không trở thành unhandled rejection. */
export function useZaloAction() {
  const { openSnackbar } = useSnackbar();
  return async (action) => {
    try { await action(); }
    catch (error) {
      openSnackbar({ text: error?.message || "Chưa thực hiện được thao tác. Vui lòng thử lại trong Zalo.", type: "error" });
    }
  };
}
