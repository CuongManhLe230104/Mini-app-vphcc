const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const project = process.env.REVIEW_PROJECT || path.resolve(__dirname, '..');

test('Mini App feedback page has simplified 3-field form, no target selector, no Zalo autofill, and no persistent storage', () => {
  const feedbackPage = fs.readFileSync(path.join(project, 'src/pages/feedback.jsx'), 'utf8');

  // Không còn mục chọn "Góp ý về"
  assert.equal(feedbackPage.includes('Góp ý về'), false);

  // Không tự lấy thông tin từ Zalo SDK và không lưu vào localStorage / sessionStorage
  assert.equal(/zmp-sdk|services\/zalo|getUserInfo|getPhoneNumber|getAccessToken/.test(feedbackPage), false);
  assert.equal(/localStorage|sessionStorage/.test(feedbackPage), false);

  // Không render HTML không an toàn
  assert.equal(feedbackPage.includes('dangerouslySetInnerHTML'), false);

  // Giữ đầy đủ thông báo mục đích thu thập và biên nhận mã góp ý
  assert.equal(
    feedbackPage.includes(
      'Họ tên và số điện thoại được dùng để tiếp nhận, xử lý và liên hệ phản hồi góp ý. Thông tin chỉ được cung cấp cho cán bộ có quyền xử lý, không hiển thị công khai.',
    ),
    true,
  );
  assert.equal(feedbackPage.includes('Trung tâm đã tiếp nhận góp ý của bạn.'), true);
  assert.equal(feedbackPage.includes('"Idempotency-Key"'), true);
});

test('Admin feedback page omits assignment/status workflows and supports summary + Excel export', () => {
  const adminFeedback = fs.readFileSync(path.join(project, 'admin/src/pages/FeedbackPage.jsx'), 'utf8');

  assert.equal(adminFeedback.includes('dangerouslySetInnerHTML'), false);
  assert.equal(adminFeedback.includes('Phân công người xử lý'), false);
  assert.equal(adminFeedback.includes('Cập nhật trạng thái xử lý'), false);
  assert.equal(
    adminFeedback.includes('Thông tin do người gửi cung cấp — Số điện thoại chưa xác thực'),
    true,
  );
  assert.equal(adminFeedback.includes('exportFeedbackExcel'), true);
});
