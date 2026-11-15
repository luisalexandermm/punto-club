const supabase = require('../lib/supabase');
const { ok, err, allowCors, makeToken, verifyPassword, hashPassword } = require('../lib/helpers');
const { quienDe, cuenta, anotar, demasiados } = require('../lib/limite');

/* Frenos contra quien intenta adivinar la contraseña:
   - 5 contraseñas equivocadas desde la misma conexión → 15 minutos bloqueada.
   - 60 equivocadas en total en una hora (ataque desde muchas conexiones) → ingreso pausado 15 minutos. */
const MAX_IP = 5, VENTANA_IP = 15;
const MAX_TOTAL = 60, VENTANA_TOTAL = 60;
const pausa = ms => new Promise(r => setTimeout(r, ms));

module.exports = async (req, res) => {
  allowCors(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return err(res, 'Método no permitido', 405);

  const quien = quienDe(req);
  const [fallosIp, fallosTotal] = await Promise.all([
    cuenta(supabase, 'login-fallo', quien, VENTANA_IP),
    cuenta(supabase, 'login-fallo', null, VENTANA_TOTAL)
  ]);
  if (fallosIp >= MAX_IP) return demasiados(res, VENTANA_IP, `Demasiados intentos fallidos. Por seguridad, espera ${VENTANA_IP} minutos para volver a intentar.`);
  if (fallosTotal >= MAX_TOTAL) return demasiados(res, 15, 'El ingreso al panel está pausado unos minutos por muchos intentos fallidos. Intenta más tarde.');

  const { password } = req.body || {};
  if (!password || typeof password !== 'string') return err(res, 'Ingresa la contraseña', 400);
  if (password.length > 200) return err(res, 'Contraseña incorrecta', 401);

  const { data, error } = await supabase
    .from('settings')
    .select('admin_password')
    .eq('id', 'app')
    .single();

  if (error || !data) return err(res, 'Error de configuración', 500);

  if (!verifyPassword(password, data.admin_password)) {
    await anotar(supabase, 'login-fallo', quien);
    await pausa(600 + Math.floor(Math.random() * 400)); // hace lento probar contraseñas en serie
    const quedan = MAX_IP - fallosIp - 1;
    return err(res, quedan > 0 && quedan <= 2
      ? `Contraseña incorrecta. Te queda${quedan === 1 ? '' : 'n'} ${quedan} intento${quedan === 1 ? '' : 's'} antes de un bloqueo de ${VENTANA_IP} minutos.`
      : quedan <= 0 ? `Contraseña incorrecta. Por seguridad, espera ${VENTANA_IP} minutos para volver a intentar.` : 'Contraseña incorrecta', 401);
  }

  // Si la contraseña seguía guardada en texto plano (instalación antigua), la migramos a hash
  if (!String(data.admin_password).startsWith('scrypt$')) {
    supabase.from('settings').update({ admin_password: hashPassword(password) }).eq('id', 'app')
      .then(({ error: migrateError }) => { if (migrateError) console.error('No se pudo migrar la contraseña a hash:', migrateError.message); });
  }

  try {
    const token = makeToken();
    await anotar(supabase, 'login-ok', quien);
    ok(res, { token });
  } catch (e) {
    console.error(e.message);
    err(res, 'El panel no está configurado: falta TOKEN_SECRET en el servidor', 500);
  }
};
