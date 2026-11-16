const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} = require("@nestjs/common");
const { SessionGuard } = require("../dist/auth");
const {
  ProjectsController,
  PublicInvitationController,
  ImportGuestsDto,
  CreateInvitationDto,
} = require("../dist/projects");
const {
  VendorApplicationsController,
  VendorApplicationDto,
} = require("../dist/vendor-applications");
const {
  UpdateGuideDto,
  RegistryOfficeReviewDto,
  VendorApplicationReviewDto,
} = require("../dist/admin");
const { createPersistentRateLimit } = require("../dist/rate-limit");
const { VendorPortalController } = require("../dist/vendor-portal");
const { createRsvpTokenCredentials, exposeGuestRsvpToken, hashRsvpToken } = require("../dist/rsvp-token");
const { plainToInstance } = require("class-transformer");
const { validate } = require("class-validator");

const contextFor = (request) => ({
  switchToHttp: () => ({ getRequest: () => request }),
});
const catches = (type, callback) =>
  assert.rejects(callback, (error) => error instanceof type);

test("tokens RSVP são aleatórios, cifrados e removidos da resposta pública", async () => {
  const first = createRsvpTokenCredentials();
  const second = createRsvpTokenCredentials();
  assert.notEqual(first.token, second.token);
  assert.equal(first.rsvpTokenHash, hashRsvpToken(first.token));
  assert.doesNotMatch(first.rsvpTokenCiphertext, new RegExp(first.token));
  const guest = { id: "guest-1", rsvpTokenHash: first.rsvpTokenHash, rsvpTokenCiphertext: first.rsvpTokenCiphertext, rsvpTokenLegacy: null, rsvpTokenPreviousHash: null, rsvpTokenPreviousExpiresAt: null, name: "Ana" };
  const exposed = await exposeGuestRsvpToken({ guest: {} }, guest);
  assert.equal(exposed.rsvpToken, first.token);
  assert.equal(exposed.name, "Ana");
  assert.equal("rsvpTokenHash" in exposed, false);
  assert.equal("rsvpTokenCiphertext" in exposed, false);
});

test("resposta de fornecedor só altera pedidos do seu perfil e notifica o evento", async () => {
  let updated;
  let notice;
  const db = {
    quoteRequest: {
      findFirst: async () => ({ id: "quote-1", projectId: "event-1", status: "NEW", quotedAmount: null, respondedAt: null, vendor: { name: "Flor e Festa" } }),
      update: async ({ data }) => { updated = data; return { id: "quote-1", projectId: "event-1", ...data }; },
    },
    projectMember: { findMany: async () => [{ userId: "couple-1" }] },
    notification: { createMany: async ({ data }) => { notice = data[0]; } },
  };
  const result = await new VendorPortalController(db).respondToInquiry("quote-1", { id: "vendor-owner" }, { quotedAmount: 250000, responseNote: "Disponível nessa data." });
  assert.equal(result.status, "RESPONDED");
  assert.equal(updated.quotedAmount, 250000);
  assert.equal(notice.type, "QUOTE_RESPONSE_RECEIVED");
  assert.match(notice.href, /event-1/);
  const missing = new VendorPortalController({ quoteRequest: { findFirst: async () => null } });
  await catches(NotFoundException, () => missing.respondToInquiry("quote-2", { id: "another-user" }, {}));
});

test("sessão válida autentica e sessão ausente ou expirada é recusada", async () => {
  const raw = "session-token";
  const user = { id: "user-1", email: "ana@example.ao", name: "Ana" };
  const db = {
    session: {
      findUnique: async ({ where }) => {
        assert.equal(
          where.tokenHash,
          createHash("sha256").update(raw).digest("hex"),
        );
        return { expiresAt: new Date(Date.now() + 60_000), user };
      },
    },
  };
  const request = { headers: { cookie: `casar_session=${raw}` } };
  assert.equal(
    await new SessionGuard(db).canActivate(contextFor(request)),
    true,
  );
  assert.deepEqual(request.user, user);
  await catches(UnauthorizedException, () =>
    new SessionGuard(db).canActivate(contextFor({ headers: {} })),
  );
  const expired = new SessionGuard({
    session: { findUnique: async () => ({ expiresAt: new Date(0), user }) },
  });
  await catches(UnauthorizedException, () =>
    expired.canActivate(
      contextFor({ headers: { cookie: `casar_session=${raw}` } }),
    ),
  );
});

test("membro sem acesso recebe 404 e perfil de consulta não pode alterar o projecto", async () => {
  const missing = new ProjectsController({
    projectMember: { findUnique: async () => null },
  });
  await catches(NotFoundException, () => missing.owned("project-1", "user-2"));
  const viewer = new ProjectsController({
    projectMember: { findUnique: async () => ({ role: "VIEWER" }) },
  });
  assert.equal((await viewer.owned("project-1", "user-2")).role, "VIEWER");
  await catches(ForbiddenException, () =>
    viewer.owned("project-1", "user-2", true),
  );
});

test("gestão de colaboradores não pode alterar o próprio acesso nem rebaixar outro responsável", async () => {
  let findCalls = 0;
  const db = {
    projectMember: {
      findUnique: async () => {
        findCalls += 1;
        return findCalls === 1 ? { role: "OWNER" } : { role: "OWNER" };
      },
      upsert: async () =>
        assert.fail("Não devia alterar o acesso de responsável"),
    },
    user: {
      findUnique: async ({ where }) => ({
        id: where.email === "owner@example.ao" ? "owner-1" : "owner-2",
      }),
    },
  };
  const controller = new ProjectsController(db);
  await catches(BadRequestException, () =>
    controller.addMember(
      "project-1",
      { id: "owner-1" },
      { email: "owner@example.ao", role: "VIEWER" },
    ),
  );
  findCalls = 0;
  await catches(BadRequestException, () =>
    controller.addMember(
      "project-1",
      { id: "owner-1" },
      { email: "owner2@example.ao", role: "EDITOR" },
    ),
  );
});

test("responsável de uma tarefa tem de pertencer ao projecto", async () => {
  const db = {
    projectMember: {
      findUnique: async ({ where }) =>
        where.projectId_userId.userId === "outsider-1"
          ? null
          : { role: "OWNER" },
    },
    task: {
      create: async () =>
        assert.fail("Não devia atribuir a tarefa a um não membro"),
    },
  };
  const controller = new ProjectsController(db);
  await catches(BadRequestException, () =>
    controller.addTask(
      "project-1",
      { id: "owner-1" },
      {
        title: "Confirmar o espaço",
        assigneeUserId: "outsider-1",
      },
    ),
  );
});

test("uma tarefa criada a partir do quadro mantém o estado da coluna escolhida", async () => {
  let saved;
  const controller = new ProjectsController({
    projectMember: { findUnique: async () => ({ role: "OWNER" }) },
    task: { create: async ({ data }) => (saved = data) },
  });
  await controller.addTask(
    "project-1",
    { id: "owner-1" },
    { title: "Confirmar o espaço", status: "WAITING" },
  );
  assert.equal(saved.status, "WAITING");
  assert.equal(saved.projectId, "project-1");
});

test("uma despesa não pode ligar-se a uma tarefa de outro evento", async () => {
  const controller = new ProjectsController({
    projectMember: { findUnique: async () => ({ role: "OWNER" }) },
    task: { findFirst: async () => null },
    expense: {
      create: async () =>
        assert.fail("Não devia criar despesa com uma tarefa externa"),
    },
  });
  await catches(BadRequestException, () =>
    controller.addExpense(
      "project-1",
      { id: "owner-1" },
      {
        title: "Sinal do espaço",
        amount: 5000,
        taskId: "task-from-other-project",
      },
    ),
  );
});

test("RSVP não aceita um grupo maior do que o limite do convite", async () => {
  const token = createRsvpTokenCredentials();
  const invitationDb = {
    invitation: {
      findUnique: async () => ({ projectId: "project-1", isPublic: true }),
    },
    guest: {
      findFirst: async () => ({
        id: "guest-1",
        projectId: "project-1",
        maxPartySize: 2,
        rsvpTokenHash: token.rsvpTokenHash,
        rsvpTokenCiphertext: token.rsvpTokenCiphertext,
        rsvpTokenLegacy: null,
        rsvpTokenPreviousHash: null,
        rsvpTokenPreviousExpiresAt: null,
      }),
      findUnique: async () => null,
    },
    rSVP: {
      upsert: async () => assert.fail("Não devia gravar RSVP acima do limite"),
    },
  };
  const controller = new PublicInvitationController(invitationDb);
  await catches(BadRequestException, () =>
    controller.rsvp("invite-1", {
      token: "token-1",
      status: "ACCEPTED",
      partySize: 3,
    }),
  );
});

test("limite do convite não pode ficar abaixo do grupo já confirmado", async () => {
  const controller = new ProjectsController({
    projectMember: { findUnique: async () => ({ role: "OWNER" }) },
    guest: {
      findFirst: async () => ({
        id: "guest-1",
        projectId: "project-1",
        maxPartySize: 4,
        seatingTableId: null,
        rsvps: [{ status: "ACCEPTED", partySize: 3 }],
      }),
      update: async () => assert.fail("Não devia reduzir o limite confirmado"),
    },
  });
  await catches(BadRequestException, () =>
    controller.updateGuest(
      "project-1",
      "guest-1",
      { id: "owner-1" },
      { maxPartySize: 2 },
    ),
  );
});

test("atribuir um grupo a uma mesa respeita a capacidade por pessoa", async () => {
  const db = {
    seatingTable: {
      findFirst: async () => ({
        capacity: 4,
        guests: [{ id: "guest-existing", maxPartySize: 3, rsvps: [] }],
      }),
    },
  };
  const controller = new ProjectsController(db);
  await catches(ForbiddenException, () =>
    controller.assertTableCapacity("project-1", "table-1", undefined, 2),
  );
  await controller.assertTableCapacity("project-1", "table-1", undefined, 1);

  const declined = new ProjectsController({
    seatingTable: {
      findFirst: async () => ({
        capacity: 4,
        guests: [
          {
            id: "guest-declined",
            maxPartySize: 4,
            rsvps: [{ status: "DECLINED", partySize: 1 }],
          },
        ],
      }),
    },
  });
  await declined.assertTableCapacity("project-1", "table-1", undefined, 4);
});

test("candidatura de fornecedor guarda email normalizado sem publicar o perfil", async () => {
  let saved;
  const controller = new VendorApplicationsController({
    vendorApplication: {
      create: async ({ data, select }) => {
        saved = { data, select };
        return {
          id: "application-1",
          status: "NEW",
          createdAt: new Date("2026-11-13T00:00:00Z"),
        };
      },
    },
  });
  const result = await controller.create({
    businessName: "Doce Festa",
    contactName: "Ana",
    email: " ANA@EXAMPLE.AO ",
    phone: "+244 923 000 000",
    category: "Bolos e doces",
    province: "Luanda",
    message: "Prestamos serviço de catering e doces há cinco anos.",
  });
  assert.equal(saved.data.email, "ana@example.ao");
  assert.equal(saved.data.phone, "+244 923 000 000");
  assert.equal(saved.data.status, undefined);
  assert.equal(result.status, "NEW");
});

test("DTOs administrativos e candidatura validam os dados em runtime", async () => {
  const badGuide = await validate(
    plainToInstance(UpdateGuideDto, { status: "PUBLIC" }),
  );
  const badOffice = await validate(
    plainToInstance(RegistryOfficeReviewDto, {
      status: "CONFIRMED",
      reviewedAt: "ontem",
    }),
  );
  const badApplicationReview = await validate(
    plainToInstance(VendorApplicationReviewDto, { status: "CONVERTED" }),
  );
  const badApplication = await validate(
    plainToInstance(VendorApplicationDto, {
      businessName: "A",
      email: "email-invalido",
      message: "curto",
    }),
  );
  assert.ok(badGuide.length > 0);
  assert.ok(badOffice.length > 0);
  assert.ok(badApplicationReview.length > 0);
  assert.ok(badApplication.length >= 3);
  const validApplication = plainToInstance(VendorApplicationDto, {
    businessName: "Doce Festa",
    contactName: "Ana",
    email: "ana@example.ao",
    phone: "+244 923 000 000",
    category: "Bolos",
    province: "Luanda",
    municipality: "",
    website: "",
    message: "Prestamos serviço de catering e doces há cinco anos.",
  });
  assert.deepEqual(await validate(validApplication), []);
});

test("importação ignora contactos duplicados e cria os restantes", async () => {
  let created;
  const controller = new ProjectsController({
    projectMember: { findUnique: async () => ({ role: "OWNER" }) },
    guest: {
      findMany: async () => [
        {
          name: "Ana Silva",
          email: "ana@example.ao",
          phone: null,
          groupName: "Família",
        },
        { name: "Carlos", email: null, phone: null, groupName: "Amigos" },
      ],
      createMany: async ({ data }) => {
        created = data;
        return { count: data.length };
      },
    },
  });
  const result = await controller.importGuests(
    "project-1",
    { id: "owner-1" },
    {
      guests: [
        { name: "Ana Silva", email: " ANA@example.ao ", groupName: "Família" },
        { name: "Carlos", groupName: "Amigos" },
        {
          name: "Beatriz",
          phone: "+244 923 000 000",
          groupName: "Amigos",
          maxPartySize: 2,
        },
        {
          name: "Beatriz duplicada",
          phone: "244923000000",
          groupName: "Amigos",
        },
      ],
    },
  );
  assert.equal(result.createdCount, 1);
  assert.equal(result.skippedCount, 3);
  assert.equal(created[0].projectId, "project-1");
  assert.equal(created[0].maxPartySize, 2);
});

test("DTO de importação valida linhas e limita o tamanho do ficheiro", async () => {
  const invalid = plainToInstance(ImportGuestsDto, {
    guests: [{ name: "A", maxPartySize: 11 }],
  });
  const oversized = plainToInstance(ImportGuestsDto, {
    guests: Array.from({ length: 501 }, () => ({ name: "Convidado" })),
  });
  assert.ok((await validate(invalid)).length > 0);
  assert.ok((await validate(oversized)).length > 0);
});

test("tema do convite valida e fica guardado ao publicar", async () => {
  let saved;
  const controller = new ProjectsController({
    projectMember: { findUnique: async () => ({ role: "OWNER" }) },
    invitation: {
      findFirst: async () => null,
      create: async ({ data }) => (saved = data),
    },
  });
  await controller.publishInvitation(
    "project-123456",
    { id: "owner-1" },
    { headline: "Ana e Miguel", message: "Até breve!", theme: "BOTANICAL" },
  );
  assert.equal(saved.theme, "BOTANICAL");
  assert.equal(saved.isPublic, true);
  const invalid = plainToInstance(CreateInvitationDto, { theme: "NEON" });
  assert.ok((await validate(invalid)).length > 0);
});

test("limite persistente bloqueia pedidos acima do máximo por IP e conta", async () => {
  const values = new Map();
  const db = {
    $queryRaw: async (_strings, key) => {
      const count = (values.get(key) ?? 0) + 1;
      values.set(key, count);
      return [{ count }];
    },
    rateLimitBucket: { deleteMany: async () => ({ count: 0 }) },
  };
  const middleware = createPersistentRateLimit(db, 2, 60_000);
  async function request() {
    let status;
    let body;
    let advanced = false;
    const response = {
      status(value) {
        status = value;
        return this;
      },
      json(value) {
        body = value;
        return this;
      },
    };
    middleware(
      {
        originalUrl: "/api/v1/auth/login",
        method: "POST",
        ip: "127.0.0.1",
        body: { email: "ana@example.ao" },
      },
      response,
      () => {
        advanced = true;
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { status, body, advanced };
  }
  assert.equal((await request()).advanced, true);
  assert.equal((await request()).advanced, true);
  const blocked = await request();
  assert.equal(blocked.status, 429);
  assert.match(blocked.body.message, /Demasiadas tentativas/);
});
