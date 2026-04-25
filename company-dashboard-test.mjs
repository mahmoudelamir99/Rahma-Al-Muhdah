import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

const root = path.resolve('./');
const html = fs.readFileSync(path.join(root, 'company-dashboard.html'), 'utf8');
const siteSource = fs.readFileSync(path.join(root, 'site.js'), 'utf8');
const cleanedHtml = html
  .replace(/<script[^>]*src="[^"]*site\.js[^"]*"[^>]*>\s*<\/script>/i, '')
  .replace(/<script[^>]*src="[^"]*firebase-site-config\.js[^"]*"[^>]*>\s*<\/script>/i, '')
  .replace(/<script[^>]*src="[^"]*supabase-site-config\.js[^"]*"[^>]*>\s*<\/script>/i, '')
  .replace(/<link[^>]*href="[^"]*\.css[^"]*"[^>]*>/gi, '');

const profile = {
  role: 'company',
  fullName: 'شركة تجربة',
  companyName: 'شركة تجربة',
  email: 'company@example.com',
  companyId: 'company-001',
  accountStatus: 'active',
  status: 'approved',
  companyProfile: {
    companyName: 'شركة تجربة',
    companySector: 'تكنولوجيا',
    companyCity: 'القاهرة',
    phone: '01010010010',
    email: 'company@example.com',
    website: 'https://example.com',
    jobs: [],
    draft: {},
  },
};

const session = {
  loggedIn: true,
  role: 'company',
  provider: 'supabase',
  email: 'company@example.com',
  name: 'شركة تجربة',
  companyId: 'company-001',
  loggedInAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
};

const applications = [
  {
    requestId: '1001',
    id: '1001',
    status: 'review',
    submittedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    applicant: {
      fullName: 'أحمد علي',
      phone: '01012345678',
      email: 'ahmed@example.com',
      city: 'القاهرة',
      experience: '3 سنوات خبرة',
    },
    job: {
      jobTitle: 'مهندس برمجيات',
      jobCompany: 'شركة تجربة',
      jobLocation: 'القاهرة',
    },
    company: {
      email: 'company@example.com',
      id: 'company-001',
    },
  },
];

const dom = new JSDOM(cleanedHtml, {
  url: 'http://localhost/company-dashboard.html',
  pretendToBeVisual: true,
  runScripts: 'dangerously',
  resources: 'usable',
});
const { window } = dom;
const { document } = window;

window.confirm = () => true;
window.prompt = () => 'سبب الرفض التجريبي';
window.alert = () => {};
window.navigator.clipboard = {
  writeText: async () => true,
};
window.matchMedia = () => ({
  matches: false,
  media: '',
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});
Object.defineProperty(window.navigator, 'deviceMemory', {
  value: 8,
  configurable: true,
});
Object.defineProperty(window.navigator, 'hardwareConcurrency', {
  value: 4,
  configurable: true,
});
window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
window.cancelAnimationFrame = clearTimeout;
window.URL.createObjectURL = () => 'blob://test';
window.URL.revokeObjectURL = () => {};
window.document.execCommand = () => false;
window.Blob = window.Blob || class Blob {
  constructor(parts, opts = {}) {
    this.parts = parts;
    this.type = opts.type || '';
  }
};
window.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.HTMLElement.prototype.scrollIntoView = () => {};
window.createId = (prefix = 'id') => `${String(prefix).trim() || 'id'}-${Math.random().toString(36).slice(2, 10)}`;
window.generateId = window.createId;
window.localStorage.clear();
window.sessionStorage.clear();
window.localStorage.setItem('rahmaApplicationProfile', JSON.stringify(profile));
window.localStorage.setItem('rahmaAuthSession', JSON.stringify(session));
window.localStorage.setItem('rahmaJobApplications', JSON.stringify(applications));

const injectionMarker = '})();';
const markerIndex = siteSource.lastIndexOf(injectionMarker);
if (markerIndex < 0) {
  throw new Error('Unable to find IIFE termination marker in site.js');
}
const modifiedSource = `${siteSource.slice(0, markerIndex)}
  window.__rahmaTest = {
    renderCompanyDashboard,
    getStoredProfile,
    getSession,
    refreshCompanySession,
    getCompanyStoredJobs,
    persistCompanyJobsProfile,
    getStoredApplications,
    saveLocalStoredApplications,
    updateCompanyApplicationStatus,
  };
${siteSource.slice(markerIndex)}`;

window.eval(modifiedSource);
const {
  renderCompanyDashboard,
  getStoredProfile,
  getSession,
  refreshCompanySession,
  getCompanyStoredJobs,
  persistCompanyJobsProfile,
  getStoredApplications,
  saveLocalStoredApplications,
  updateCompanyApplicationStatus,
} = window.__rahmaTest;

const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

const submitJobForm = async (values) => {
  const form = document.querySelector('[data-company-job-form="true"]');
  if (!form) throw new Error('Job form not found');
  Object.entries(values).forEach(([name, value]) => {
    const field = form.querySelector(`[name="${name}"]`);
    if (field) {
      if (field.type === 'checkbox') {
        field.checked = Boolean(value);
      } else {
        field.value = value;
      }
    }
  });
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await wait(200);
};

const rerender = async () => {
  await renderCompanyDashboard();
  await wait(120);
};

const results = [];

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const getJobsRows = () =>
  Array.from(document.querySelectorAll('[data-company-jobs-body] tr')).filter(
    (tr) => !tr.querySelector('td[colspan]'),
  );

(async () => {
  await rerender();
  results.push('Dashboard rendered');

  const profileFromStorage = getStoredProfile();
  assert(profileFromStorage.companyName === 'شركة تجربة', 'Stored profile mismatch');
  results.push('Company profile loaded');

  await submitJobForm({
    job_title: 'مهندس برمجيات',
    job_city: 'القاهرة',
    job_type: 'دوام كامل',
    job_salary: '12000 جنيه',
    job_positions: '2',
    job_featured: true,
    job_description: 'تطوير وصيانة نظم تطبيقات الويب.',
  });
  await rerender();
  const jobsAfterAdd = getCompanyStoredJobs(getStoredProfile(), getSession());
  assert(jobsAfterAdd.length === 1, 'Job was not added');
  results.push('Added job successfully');

  const row = getJobsRows()[0];
  assert(row && row.textContent.includes('مهندس برمجيات'), 'New job row missing');
  results.push('Job appears in dashboard table');

  const editButton = document.querySelector('[data-company-job-edit]');
  assert(editButton, 'Edit job button missing');
  editButton.click();
  await wait(100);
  const titleField = document.querySelector('[name="job_title"]');
  titleField.value = 'مهندس برمجيات أول';
  const form = document.querySelector('[data-company-job-form="true"]');
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await rerender();
  assert(getCompanyStoredJobs(getStoredProfile(), getSession())[0].title === 'مهندس برمجيات أول', 'Job edit did not persist');
  results.push('Edited job successfully');

  const publishButton = document.querySelector('[data-company-job-publish]');
  assert(publishButton, 'Publish toggle button missing');
  publishButton.click();
  await rerender();
  const jobAfterPublishToggle = getCompanyStoredJobs(getStoredProfile(), getSession())[0];
  assert(jobAfterPublishToggle.status === 'hidden', 'Job publish toggle did not set hidden');
  results.push('Publish/unpublish toggle works');

  const archiveButton = document.querySelector('[data-company-job-archive]');
  assert(archiveButton, 'Archive button missing');
  archiveButton.click();
  await rerender();
  const jobAfterArchive = getCompanyStoredJobs(getStoredProfile(), getSession())[0];
  assert(jobAfterArchive.status === 'archived', 'Job archive did not persist');
  results.push('Archive action works');

  const deleteButton = document.querySelector('[data-company-job-delete]');
  assert(deleteButton, 'Delete button missing');
  deleteButton.click();
  await rerender();
  const deletedJob = getCompanyStoredJobs(getStoredProfile(), getSession())[0];
  assert(deletedJob.deletedAt, 'Job deletion did not set deletedAt');
  results.push('Delete action works');

  const applicantApplications = getStoredApplications();
  assert(applicantApplications.length === 1, 'Initial applicant data missing');
  results.push('Applicant data loaded');

  const approveButton = document.querySelector('[data-company-application-action="approved"]');
  assert(approveButton, 'Approve button missing');
  approveButton.click();
  await wait(200);
  await rerender();
  const updatedApplicationApproved = getStoredApplications().find((app) => app.requestId === '1001');
  assert(updatedApplicationApproved.status === 'approved', 'Approve action did not update status');
  results.push('Approve action works');

  const interviewButton = document.querySelector('[data-company-application-action="interview"]');
  assert(interviewButton, 'Interview button missing');
  interviewButton.click();
  await wait(200);
  await rerender();
  const updatedInterviewApplication = getStoredApplications().find((app) => app.requestId === '1001');
  assert(updatedInterviewApplication.status === 'interview', 'Interview action did not update status');
  results.push('Interview action works');

  const rejectButton = document.querySelector('[data-company-application-action="rejected"]');
  assert(rejectButton, 'Reject button missing');
  rejectButton.click();
  await wait(200);
  await rerender();
  const updatedRejectedApplication = getStoredApplications().find((app) => app.requestId === '1001');
  assert(updatedRejectedApplication.status === 'rejected', 'Reject action did not update status');
  results.push('Reject action works');

  const manageButton = document.querySelector('[data-company-application-manage]');
  assert(manageButton, 'Manage applicant button missing');
  manageButton.click();
  await wait(100);
  const modal = document.querySelector('[data-company-review-modal]');
  assert(modal && !modal.classList.contains('hidden'), 'Review modal did not open');
  results.push('Review modal opens');

  const reviewForm = document.querySelector('[data-company-review-form="true"]');
  reviewForm.elements.application_status.value = 'interview';
  reviewForm.elements.application_tag.value = 'strong';
  reviewForm.elements.application_note.value = 'تم تحديد مقابلة';
  reviewForm.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await wait(200);
  const reviewedApplication = getStoredApplications().find((app) => app.requestId === '1001');
  assert(reviewedApplication.status === 'interview', 'Review form did not update status');
  results.push('Review form submit works');

  console.log('TEST_RESULT_OK');
  console.log(results.join('\n'));
})().catch((error) => {
  console.error('TEST_RESULT_FAILED');
  console.error(error);
  process.exit(1);
});
