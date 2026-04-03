import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SITE_NAME = 'الرحمة المهداه للتوظيف';
const DEFAULT_OG_IMAGE = '/logo-mark.png';

const SEO_MARKER_START = '<!-- RAHMA SEO START -->';
const SEO_MARKER_END = '<!-- RAHMA SEO END -->';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const pages = {
  'index.html': {
    title: 'وظائف في مصر وفرص عمل وتوظيف شركات | الرحمة المهداه للتوظيف',
    description:
      'اعثر على وظائف في مصر وفرص عمل حقيقية وتوظيف شركات من منصة عربية منظمة تعرض الوظائف المنشورة فعليًا وتسهّل التقديم والمتابعة.',
    keywords: 'وظائف في مصر, فرص عمل, توظيف شركات, وظائف شاغرة, تقديم وظائف, وظائف القاهرة, وظائف العاشر من رمضان',
    canonical: '/',
  },
  'jobs.html': {
    title: 'وظائف في مصر | فرص عمل منشورة وتقديم مباشر | الرحمة المهداه للتوظيف',
    description:
      'استعرض وظائف في مصر وفرص عمل منشورة فعليًا مع فلترة سريعة وتقديم مباشر ورقم طلب واضح للمتابعة من نفس المنصة.',
    keywords: 'وظائف في مصر, فرص عمل, وظائف شاغرة, تقديم وظائف, توظيف شركات, وظائف القاهرة, وظائف العاشر من رمضان',
    canonical: '/jobs.html',
  },
  'companies.html': {
    title: 'توظيف شركات | دليل الشركات النشطة والفرص الحالية | الرحمة المهداه للتوظيف',
    description:
      'دليل توظيف شركات يعرض الشركات النشطة والفرص الحالية بشكل منظم مع الوصول السريع إلى التفاصيل والوظائف المرتبطة.',
    keywords: 'توظيف شركات, شركات في مصر, وظائف الشركات, دليل الشركات, فرص عمل, شركات القاهرة',
    canonical: '/companies.html',
  },
  'about.html': {
    title: 'من نحن | منصة وظائف في مصر وتوظيف شركات | الرحمة المهداه للتوظيف',
    description:
      'تعرف على منصة الرحمة المهداه للتوظيف وكيف نعرض وظائف في مصر وفرص عمل وتوظيف شركات داخل تجربة عربية واضحة وسريعة.',
    keywords: 'من نحن, وظائف في مصر, توظيف شركات, فرص عمل, الرحمة المهداه للتوظيف',
    canonical: '/about.html',
  },
  'contact.html': {
    title: 'تواصل معنا | دعم ومتابعة الطلبات | الرحمة المهداه للتوظيف',
    description:
      'تواصل معنا للاستفسار عن وظائف في مصر وفرص عمل وتوظيف شركات أو لمتابعة الطلبات والدعم عبر واتساب ونموذج التواصل.',
    keywords: 'تواصل معنا, دعم الوظائف, متابعة الطلب, وظائف في مصر, توظيف شركات',
    canonical: '/contact.html',
  },
  'track-application.html': {
    title: 'متابعة الطلب | اعرف حالة طلبك ورقم الطلب | الرحمة المهداه للتوظيف',
    description:
      'تابع حالة طلبك برقم الطلب أو رقم الهاتف واعرف إن كان الطلب قيد المراجعة أو تم قبوله أو رفضه مع السبب عند توفره.',
    keywords: 'متابعة الطلب, رقم الطلب, حالة الطلب, وظائف في مصر, فرص عمل, توظيف شركات',
    canonical: '/track-application.html',
  },
  'job-details.html': {
    title: 'تفاصيل الوظيفة | فرص عمل وتقديم مباشر | الرحمة المهداه للتوظيف',
    description:
      'اعرف تفاصيل الوظيفة والمتطلبات والراتب وطريقة التقديم المباشر على فرص عمل حقيقية داخل منصة وظائف في مصر.',
    keywords: 'تفاصيل الوظيفة, وظائف في مصر, فرص عمل, تقديم وظائف, وظائف شاغرة, توظيف شركات',
    canonical: '/job-details.html',
  },
  'company-details.html': {
    title: 'تفاصيل الشركة | اعرف الملف الوظيفي والفرص الحالية | الرحمة المهداه للتوظيف',
    description:
      'اعرف ملف الشركة والقطاع والموقع وعدد الوظائف الحالية قبل التقديم على فرص عمل مرتبطة بها داخل توظيف شركات.',
    keywords: 'تفاصيل الشركة, توظيف شركات, شركات في مصر, وظائف الشركات, فرص عمل',
    canonical: '/company-details.html',
  },
  'privacy.html': {
    title: 'سياسة الخصوصية | الرحمة المهداه للتوظيف',
    description:
      'اطلع على سياسة الخصوصية الخاصة بمنصة الرحمة المهداه للتوظيف وكيف نتعامل مع البيانات الشخصية بشكل آمن وواضح.',
    keywords: 'سياسة الخصوصية, الرحمة المهداه للتوظيف, بيانات المستخدم, وظائف في مصر',
    canonical: '/privacy.html',
  },
  'terms.html': {
    title: 'الشروط والأحكام | الرحمة المهداه للتوظيف',
    description:
      'اقرأ الشروط والأحكام المنظمة لاستخدام منصة وظائف في مصر وتوظيف شركات قبل التقديم أو إنشاء الحساب.',
    keywords: 'الشروط والأحكام, وظائف في مصر, توظيف شركات, الرحمة المهداه للتوظيف',
    canonical: '/terms.html',
  },
  'faq.html': {
    title: 'جاري التحويل | الرحمة المهداه للتوظيف',
    description: 'صفحة تحويل مؤقتة إلى تواصل معنا لحين تجهيز قسم الأسئلة الشائعة بشكل جديد.',
    keywords: 'الأسئلة الشائعة, تواصل معنا, الرحمة المهداه للتوظيف',
    canonical: '/contact.html',
    robots: 'noindex,nofollow',
  },
  'company-dashboard.html': {
    title: 'لوحة الشركة | إدارة الوظائف والطلبات | الرحمة المهداه للتوظيف',
    description:
      'لوحة الشركة الداخلية لإدارة الوظائف والطلبات وتحديث بيانات الشركة داخل منصة التوظيف بشكل مباشر وآمن.',
    keywords: 'لوحة الشركة, إدارة الوظائف, إدارة الطلبات, توظيف شركات',
    canonical: '/company-dashboard.html',
    robots: 'noindex,nofollow',
  },
  'messages.html': {
    title: 'الرسائل والدعم | الرحمة المهداه للتوظيف',
    description:
      'صفحة داخلية للرسائل والدعم والتنبيهات ومتابعة الطلبات داخل منصة الرحمة المهداه للتوظيف.',
    keywords: 'الرسائل والدعم, متابعة الطلبات, تنبيهات الحساب, توظيف شركات',
    canonical: '/messages.html',
    robots: 'noindex,nofollow',
  },
  'admin-login.html': {
    title: 'بوابة دخول الأدمن | الرحمة المهداه للتوظيف',
    description: 'بوابة دخول الإدارة المخصصة للأدمن فقط لإدارة المنصة بشكل آمن.',
    keywords: 'بوابة الأدمن, لوحة الإدارة, الرحمة المهداه للتوظيف',
    canonical: '/admin-login.html',
    robots: 'noindex,nofollow',
  },
  'admin-panel.html': {
    title: 'لوحة التحكم الرئيسية | الرحمة المهداه للتوظيف',
    description: 'لوحة التحكم الداخلية المخصصة لإدارة المنصة والبيانات والصلاحيات.',
    keywords: 'لوحة التحكم, الإدارة, الرحمة المهداه للتوظيف',
    canonical: '/admin-panel.html',
    robots: 'noindex,nofollow',
  },
  'al-rahma-recruitment-admin/index.html': {
    title: 'لوحة إدارة الرحمة المهداه',
    description: 'لوحة الإدارة الداخلية لإدارة المحتوى والشركات والوظائف والطلبات.',
    keywords: 'لوحة الإدارة, إدارة الشركات, إدارة الوظائف, إدارة الطلبات',
    canonical: '/al-rahma-recruitment-admin/index.html',
    robots: 'noindex,nofollow',
  },
  'تسجيل-الدخول-وإنشاء-حساب/index.html': {
    title: 'بوابة الشركات | الرحمة المهداه للتوظيف',
    description: 'بوابة تسجيل الدخول وإنشاء حساب الشركات داخل منصة الرحمة المهداه للتوظيف.',
    keywords: 'تسجيل دخول الشركات, إنشاء حساب شركة, بوابة الشركات, توظيف شركات',
    canonical: '/تسجيل-الدخول-وإنشاء-حساب/index.html',
    robots: 'noindex,nofollow',
  },
};

function renderSeoBlock(config) {
  const title = escapeHtml(config.title);
  const description = escapeHtml(config.description);
  const keywords = escapeHtml(config.keywords || '');
  const robots = escapeHtml(config.robots || 'index,follow');
  const canonical = escapeHtml(config.canonical || '/');
  const ogType = escapeHtml(config.ogType || 'website');
  const ogImage = escapeHtml(config.ogImage || DEFAULT_OG_IMAGE);

  return [
    SEO_MARKER_START,
    `  <meta name="description" content="${description}">`,
    keywords ? `  <meta name="keywords" content="${keywords}">` : '',
    `  <meta name="robots" content="${robots}">`,
    `  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">`,
    `  <meta property="og:type" content="${ogType}">`,
    `  <meta property="og:title" content="${title}">`,
    `  <meta property="og:description" content="${description}">`,
    `  <meta property="og:url" content="${canonical}">`,
    `  <meta property="og:image" content="${ogImage}">`,
    `  <meta property="og:locale" content="ar_EG">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    `  <meta name="twitter:title" content="${title}">`,
    `  <meta name="twitter:description" content="${description}">`,
    `  <meta name="twitter:image" content="${ogImage}">`,
    `  <link rel="canonical" href="${canonical}">`,
    SEO_MARKER_END,
  ]
    .filter(Boolean)
    .join('\n');
}

async function main() {
  const entries = Object.entries(pages);

  for (const [relativePath, config] of entries) {
    const filePath = path.join(rootDir, relativePath);
    let html = await readFile(filePath, 'utf8');

    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(config.title)}</title>`);
    html = html.replace(
      new RegExp(`\\s*${SEO_MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${SEO_MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'),
      '\n',
    );
    html = html.replace('</head>', `  ${renderSeoBlock(config)}\n</head>`);

    await writeFile(filePath, html, 'utf8');
    console.log(`Updated SEO for ${relativePath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
