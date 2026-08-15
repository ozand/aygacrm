# AygaCRM Migration Plan
## Laravel → Next.js 16 + Prisma 7

---

## Статус: Перенесено vs Осталось

### ✅ ПЕРЕНЕСЕНО (Фаза 1 - Завершена)

| # | Функционал | Статус | Файлы |
|---|-----------|--------|-------|
| 1 | **Аутентификация** | ✅ Done | auth.ts, login, register |
| 2 | **Контакты CRUD** | ✅ Done | contacts.ts, contacts/* |
| 3 | **Заметки (Notes)** | ✅ Done | notes.ts, note-form.tsx |
| 4 | **Важные даты** | ✅ Done | important-dates.ts |
| 5 | **Dashboard** | ✅ Done | dashboard.ts, dashboard/page.tsx |
| 6 | **Метки (Labels)** | ✅ Done | labels.ts, labels/* |
| 7 | **Напоминания (Reminders)** | ✅ Done | reminders.ts, reminder-form.tsx |
| 8 | **Import/Export CSV/vCard** | ✅ Done | export-contacts.ts, import-contacts.ts |
| 9 | **Relationships** | ✅ Done | relationships.ts, relationship-form.tsx |
| 10 | **Notification Channels** | ✅ Done | notification-channels.ts, settings page |

---

## 🔄 ПЛАН МИГРАЦИИ (Фазы 2-6)

### Фаза 2: Contact Modules (Расширение карточки контакта)

| # | Модуль | Оригинал | Приоритет | Сложность |
|---|--------|----------|-----------|-----------|
| 11 | **Avatar/Photos** | ManageAvatar, ManagePhotos | High | Medium |
| 12 | **Calls** | ManageCalls | Medium | Medium |
| 13 | **Tasks** | ManageTasks | High | Medium |
| 14 | **Pets** | ManagePets | Low | Easy |
| 15 | **Gifts** | (in Settings) | Medium | Medium |
| 16 | **Debts/Loans** | ManageLoans | Medium | Medium |
| 17 | **Goals** | ManageGoals | Low | Medium |
| 18 | **Life Events** | ManageLifeEvents | Medium | Hard |
| 19 | **Mood Tracking** | ManageMoodTrackingEvents | Low | Medium |
| 20 | **Religion** | ManageReligion | Low | Easy |
| 21 | **Pronouns** | ManagePronouns | Low | Easy |
| 22 | **Quick Facts** | ManageQuickFacts | Medium | Easy |
| 23 | **Contact Feed** | ManageContactFeed | Medium | Hard |
| 24 | **Documents** | ManageDocuments | Medium | Hard |

### Фаза 3: Vault-Level Features (Глобальные страницы)

| # | Функционал | Оригинал | Приоритет | Сложность |
|---|-----------|----------|-----------|-----------|
| 25 | **Journal** | ManageJournals, Journal/* | High | Hard |
| 26 | **Calendar** | ManageCalendar, Calendar/* | High | Hard |
| 27 | **Companies** | ManageCompanies | Medium | Medium |
| 28 | **Files Storage** | ManageFiles | Medium | Hard |
| 29 | **Groups** | ManageGroups, Group/* | Medium | Medium |
| 30 | **Reports** | ManageReports | Low | Hard |
| 31 | **Life Metrics** | ManageLifeMetrics | Low | Medium |
| 32 | **Global Search** | Search/* | High | Medium |

### Фаза 4: Settings & Personalization

| # | Настройка | Оригинал | Приоритет | Сложность |
|---|-----------|----------|-----------|-----------|
| 33 | **Address Types** | ManageAddressTypes | Medium | Easy |
| 34 | **Call Reasons** | ManageCallReasons | Low | Easy |
| 35 | **Contact Info Types** | ManageContactInformationTypes | Medium | Easy |
| 36 | **Currencies** | ManageCurrencies | Medium | Easy |
| 37 | **Genders** | ManageGenders | Medium | Easy |
| 38 | **Gift Occasions** | ManageGiftOccasions | Low | Easy |
| 39 | **Gift States** | ManageGiftStates | Low | Easy |
| 40 | **Group Types** | ManageGroupTypes | Medium | Easy |
| 41 | **Modules Config** | ManageModules | Medium | Medium |
| 42 | **Pet Categories** | ManagePetCategories | Low | Easy |
| 43 | **Post Templates** | ManagePostTemplates | Low | Medium |
| 44 | **Pronouns Config** | ManagePronouns | Low | Easy |
| 45 | **Relationship Types** | ManageRelationshipTypes | Medium | Easy |
| 46 | **Religions** | ManageReligion | Low | Easy |
| 47 | **Templates** | ManageTemplates | Medium | Hard |
| 48 | **User Preferences** | ManageUserPreferences | High | Medium |
| 49 | **User Management** | ManageUsers | Medium | Medium |
| 50 | **Storage Management** | ManageStorage | Medium | Hard |

### Фаза 5: Account & Security

| # | Функционал | Оригинал | Приоритет | Сложность |
|---|-----------|----------|-----------|-----------|
| 51 | **Profile Settings** | Profile/* | High | Medium |
| 52 | **WebAuthn (Passkeys)** | Webauthn/* | Low | Hard |
| 53 | **API Tokens** | API/* | Medium | Medium |
| 54 | **Cancel Account** | CancelAccount/* | Medium | Easy |
| 55 | **Privacy Policy** | PrivacyPolicy.vue | Low | Easy |
| 56 | **Terms of Service** | TermsOfService.vue | Low | Easy |

### Фаза 6: Multi-Vault & Advanced

| # | Функционал | Оригинал | Приоритет | Сложность |
|---|-----------|----------|-----------|-----------|
| 57 | **Multi-Vault Support** | ManageVault | Medium | Hard |
| 58 | **Vault Settings** | ManageVaultSettings | Medium | Medium |
| 59 | **Important Date Types** | ManageVaultImportantDateTypes | Medium | Easy |
| 60 | **DAV Sync (CardDAV)** | Dav, DavClient | Low | Very Hard |

---

## Детальное описание ключевых модулей

### 📸 Avatar/Photos (Фаза 2, #11)
**Что делает:** Загрузка аватара контакта, галерея фотографий
**Prisma модели:** `File`, `Photo`
**Компоненты:**
- `avatar-upload.tsx` — загрузка/обрезка аватара
- `photo-gallery.tsx` — просмотр фотографий
**API:** File upload через Next.js API routes

### 📞 Calls (Фаза 2, #12)
**Что делает:** Логирование звонков с контактами
**Prisma модели:** `Call`, `CallReason`
**Компоненты:**
- `call-form.tsx` — добавление звонка
- `calls-list.tsx` — история звонков
**Поля:** дата, длительность, причина, заметки

### ✅ Tasks (Фаза 2, #13)
**Что делает:** Задачи связанные с контактами
**Prisma модели:** `ContactTask`
**Компоненты:**
- `task-form.tsx` — создание задачи
- `tasks-list.tsx` — список с чекбоксами
**Поля:** название, описание, due date, completed

### 📓 Journal (Фаза 3, #25)
**Что делает:** Личный дневник с записями по дням
**Prisma модели:** `Journal`, `JournalEntry`, `Post`, `Slice`
**Страницы:**
- `/journal` — список журналов
- `/journal/[id]` — записи журнала
- `/journal/[id]/entry/[entryId]` — одна запись
**Компоненты:**
- `journal-form.tsx` — создание журнала
- `entry-editor.tsx` — редактор записи (Markdown)
- `mood-selector.tsx` — выбор настроения

### 📅 Calendar (Фаза 3, #26)
**Что делает:** Календарный вид всех событий и дат
**Компоненты:**
- `calendar-view.tsx` — месячный календарь
- `day-view.tsx` — события дня
- `event-card.tsx` — карточка события
**Интеграция:** Использует данные из ImportantDates, Reminders

### 🏢 Companies (Фаза 3, #27)
**Что делает:** Управление компаниями, привязка контактов
**Prisma модели:** `Company`
**Страницы:**
- `/companies` — список компаний
- `/companies/[id]` — детали + сотрудники
**Связи:** Contact.companyId → Company

### 👥 Groups (Фаза 3, #29)
**Что делает:** Группировка контактов (семья, команда, etc)
**Prisma модели:** `Group`, `GroupType`
**Страницы:**
- `/groups` — список групп
- `/groups/[id]` — участники группы

### 🔍 Global Search (Фаза 3, #32)
**Что делает:** Поиск по всем контактам, заметкам, записям
**Компоненты:**
- `search-command.tsx` — Cmd+K диалог
- `search-results.tsx` — результаты по категориям
**Реализация:** Full-text search в PostgreSQL

---

## Оценка трудозатрат

| Фаза | Модулей | Оценка (часов) | Сложность |
|------|---------|----------------|-----------|
| Фаза 2 | 14 | 40-60 | Medium |
| Фаза 3 | 8 | 50-70 | Hard |
| Фаза 4 | 18 | 20-30 | Easy |
| Фаза 5 | 6 | 15-25 | Medium |
| Фаза 6 | 4 | 30-50 | Hard |
| **ИТОГО** | **50** | **155-235** | — |

---

## Рекомендуемый порядок выполнения

### Sprint 1 (Фаза 2 - Важное)
1. ✅ Tasks (#13) — часто используется
2. ✅ Avatar/Photos (#11) — визуальное улучшение
3. ✅ Calls (#12) — базовый CRM функционал
4. ✅ Quick Facts (#22) — простая фича

### Sprint 2 (Фаза 3 - Ключевые страницы)
1. ✅ Global Search (#32) — критично для UX
2. ✅ Calendar (#26) — визуализация дат
3. ✅ Companies (#27) — бизнес-контакты
4. ✅ Groups (#29) — организация контактов

### Sprint 3 (Фаза 3 - Journal)
1. ✅ Journal (#25) — большая фича

### Sprint 4 (Фаза 2 - Остальное)
1. ✅ Gifts — подарки
2. ✅ Debts/Loans (#16)
3. ✅ Life Events (#18)
4. ✅ Documents (#24)
5. ✅ Contact Feed (#23)

### Sprint 5 (Фаза 4 - Settings)
1. ✅ User Preferences (#48)
2. ✅ Все типы настроек (#33-46)

### Sprint 6 (Фаза 5-6 - Advanced)
1. ✅ Profile, API Tokens
2. ✅ Multi-Vault
3. ✅ Files Storage
4. ✅ Reports

---

## Технические заметки

### File Upload Strategy
- Использовать Next.js API Routes для загрузки
- Хранение: local filesystem или S3-compatible
- Превью: sharp для обработки изображений

### Full-Text Search
- PostgreSQL `tsvector` + `tsquery`
- Или Prisma full-text search (preview)
- Индексы на: contacts.firstName, lastName, notes.body, etc.

### Calendar Component
- Использовать `react-big-calendar` или `@fullcalendar/react`
- Или кастомный на Tailwind CSS

### Rich Text Editor для Journal
- `@tiptap/react` — рекомендуется
- Или `react-markdown` для простого Markdown

---

## Prisma Schema — Недостающие модели

```prisma
// Добавить в schema.prisma:

model Call {
  id          String   @id @default(uuid())
  contactId   String
  contact     Contact  @relation(...)
  calledAt    DateTime
  duration    Int?     // minutes
  description String?
  callReasonId String?
  callReason  CallReason? @relation(...)
}

model ContactTask {
  id          String    @id @default(uuid())
  contactId   String
  contact     Contact   @relation(...)
  name        String
  description String?
  dueAt       DateTime?
  completed   Boolean   @default(false)
  completedAt DateTime?
}

model Pet {
  id         String  @id @default(uuid())
  contactId  String
  contact    Contact @relation(...)
  name       String
  petCategoryId String?
  petCategory PetCategory? @relation(...)
}

model Gift {
  id          String   @id @default(uuid())
  contactId   String
  contact     Contact  @relation(...)
  name        String
  url         String?
  amount      Decimal?
  currencyId  String?
  status      String   // idea, offered, received
  date        DateTime?
  occasionId  String?
}

model Loan {
  id          String   @id @default(uuid())
  contactId   String
  contact     Contact  @relation(...)
  amount      Decimal
  currencyId  String
  description String?
  loanedAt    DateTime
  settledAt   DateTime?
  type        String   // debt (I owe) or loan (they owe)
}

model Journal {
  id          String   @id @default(uuid())
  vaultId     String
  vault       Vault    @relation(...)
  name        String
  description String?
  entries     JournalEntry[]
}

model JournalEntry {
  id         String   @id @default(uuid())
  journalId  String
  journal    Journal  @relation(...)
  date       DateTime
  title      String?
  content    String?  // Markdown
  mood       Int?     // 1-5
  weather    String?
  photos     Photo[]
}

model Group {
  id          String   @id @default(uuid())
  vaultId     String
  vault       Vault    @relation(...)
  name        String
  groupTypeId String?
  contacts    ContactGroup[]
}

model ContactGroup {
  contactId String
  groupId   String
  contact   Contact @relation(...)
  group     Group   @relation(...)
  @@id([contactId, groupId])
}
```

---

*Создано: 2026-02-07*
*Последнее обновление: 2026-02-07*
