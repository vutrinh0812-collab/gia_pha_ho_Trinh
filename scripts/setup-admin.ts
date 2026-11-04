/**
 * Creates the admin account or changes the admin code (= password), and
 * registers it in clans/{clanId}/config/admins (DECISIONS.md D9).
 *
 *   npm run admin:setup                      # Emulator
 *   npm run admin:setup -- --real            # Real project (needs GOOGLE_APPLICATION_CREDENTIALS)
 *
 * The code is asked interactively, or read from the ADMIN_CODE environment variable.
 */
import { parseArgs } from 'node:util';
import { ask, confirm, connect, upsertAdmin } from './lib/admin';

const { values } = parseArgs({
  options: {
    real: { type: 'boolean', default: false },
    project: { type: 'string' },
  },
});

async function main(): Promise<void> {
  const ctx = connect({ real: values.real, ...(values.project ? { project: values.project } : {}) });
  console.log(`→ ${ctx.emulator ? 'Emulator' : 'Project thật'} "${ctx.projectId}", dòng họ "${ctx.clanId}", email admin ${ctx.adminEmail}`);
  const code = process.env.ADMIN_CODE ?? (await ask('Nhập mã admin mới (ít nhất 8 ký tự): '));
  if (!ctx.emulator && !(await confirm('Mã admin cũ (nếu có) sẽ hết hiệu lực và mọi phiên admin bị đăng xuất.'))) {
    console.log('Đã hủy.');
    return;
  }
  const uid = await upsertAdmin(ctx, code);
  console.log(`✓ Đã cài mã admin. UID admin: ${uid}`);
}

main().catch((e: unknown) => {
  console.error('✗', e instanceof Error ? e.message : e);
  process.exit(1);
});
