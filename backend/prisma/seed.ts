import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

async function main() {
  console.log('🚀 Iniciando semillado de base de datos PostgreSQL para HUN ChatBot...');

  // 1. Usuarios del sistema
  const adminPasswordHash = hashPassword('Admin123!');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@hun.local' },
    update: {
      name: 'Administrador HUN',
      role: 'ADMIN',
      passwordHash: adminPasswordHash,
      isActive: true,
    },
    create: {
      email: 'admin@hun.local',
      name: 'Administrador HUN',
      role: 'ADMIN',
      passwordHash: adminPasswordHash,
      isActive: true,
    },
  });
  console.log(`👤 Usuario Admin verificado: ${adminUser.email}`);

  const auxiliarPasswordHash = hashPassword('Auxiliar123!');
  const auxiliarUser = await prisma.user.upsert({
    where: { email: 'auxiliar@hun.local' },
    update: {
      name: 'Auxiliar Asistencial HUN',
      role: 'AUXILIAR',
      passwordHash: auxiliarPasswordHash,
      isActive: true,
    },
    create: {
      email: 'auxiliar@hun.local',
      name: 'Auxiliar Asistencial HUN',
      role: 'AUXILIAR',
      passwordHash: auxiliarPasswordHash,
      isActive: true,
    },
  });
  console.log(`👤 Usuario Auxiliar verificado: ${auxiliarUser.email}`);

  // 2. Sede Principal HUN
  let sede = await prisma.location.findFirst({
    where: { name: 'Hospital Universitario Nacional de Colombia (HUN)' },
  });
  if (!sede) {
    sede = await prisma.location.create({
      data: {
        name: 'Hospital Universitario Nacional de Colombia (HUN)',
        address: 'Calle 44 # 59-75, CAN, Teusaquillo, Bogotá D.C.',
        active: true,
      },
    });
  }
  console.log(`🏥 Sede creada/verificada: ${sede.name} (ID: ${sede.id})`);

  // 3. Consultorios
  const consultoriosData = [
    { name: 'Consultorio 101 - Consulta Externa', floor: 'Piso 1' },
    { name: 'Consultorio 102 - Consulta Externa', floor: 'Piso 1' },
    { name: 'Consultorio 201 - Especialidades Médicas', floor: 'Piso 2' },
    { name: 'Consultorio 202 - Cardiología y No Invasivos', floor: 'Piso 2' },
    { name: 'Consultorio 301 - Ortopedia y Valoración Quirúrgica', floor: 'Piso 3' },
    { name: 'Consultorio 302 - Procedimientos Menores', floor: 'Piso 3' },
    { name: 'Consultorio 401 - Gineco-Obstetricia', floor: 'Piso 4' },
    { name: 'Consultorio 402 - Oftalmología y Urología', floor: 'Piso 4' },
  ];

  const consultoriosMap = new Map<string, string>();
  for (const c of consultoriosData) {
    const office = await prisma.office.upsert({
      where: {
        locationId_name: {
          locationId: sede.id,
          name: c.name,
        },
      },
      update: { floor: c.floor, active: true },
      create: {
        locationId: sede.id,
        name: c.name,
        floor: c.floor,
        active: true,
      },
    });
    consultoriosMap.set(c.name, office.id);
  }
  console.log(`🚪 ${consultoriosData.length} consultorios asegurados.`);

  // 4. Especialidades Oficiales HUN
  const especialidadesDef = [
    { code: 'med_interna', name: 'Medicina Interna', officeName: 'Consultorio 201 - Especialidades Médicas' },
    { code: 'dermatologia', name: 'Dermatología', officeName: 'Consultorio 101 - Consulta Externa' },
    { code: 'cardiologia', name: 'Cardiología', officeName: 'Consultorio 202 - Cardiología y No Invasivos' },
    { code: 'ortopedia', name: 'Ortopedia y Traumatología', officeName: 'Consultorio 301 - Ortopedia y Valoración Quirúrgica' },
    { code: 'ginecologia', name: 'Ginecología y Obstetricia', officeName: 'Consultorio 401 - Gineco-Obstetricia' },
    { code: 'pediatria', name: 'Pediatría', officeName: 'Consultorio 102 - Consulta Externa' },
    { code: 'oftalmologia', name: 'Oftalmología', officeName: 'Consultorio 402 - Oftalmología y Urología' },
    { code: 'urologia', name: 'Urología', officeName: 'Consultorio 402 - Oftalmología y Urología' },
  ];

  const especialidadesMap = new Map<string, string>();
  for (const esp of especialidadesDef) {
    const specialty = await prisma.specialty.upsert({
      where: { code: esp.code },
      update: { name: esp.name, active: true },
      create: { code: esp.code, name: esp.name, active: true },
    });
    especialidadesMap.set(esp.code, specialty.id);
  }
  console.log(`🩺 ${especialidadesDef.length} especialidades aseguradas.`);

  // 5. Doctores del cuerpo médico HUN
  const doctoresDef = [
    { fullName: 'Dr. Roberto Mendoza', license: 'RM-84920', email: 'roberto.mendoza@hun.edu.co', phone: '573101112233', espCode: 'med_interna' },
    { fullName: 'Dra. Camila Torres', license: 'CT-73819', email: 'camila.torres@hun.edu.co', phone: '573102223344', espCode: 'med_interna' },
    { fullName: 'Dra. Marcela Rincón', license: 'MR-92014', email: 'marcela.rincon@hun.edu.co', phone: '573103334455', espCode: 'dermatologia' },
    { fullName: 'Dr. Julián Castro', license: 'JC-81934', email: 'julian.castro@hun.edu.co', phone: '573104445566', espCode: 'dermatologia' },
    { fullName: 'Dr. Fernando Pardo', license: 'FP-71932', email: 'fernando.pardo@hun.edu.co', phone: '573105556677', espCode: 'cardiologia' },
    { fullName: 'Dra. Andrea Morales', license: 'AM-64821', email: 'andrea.morales@hun.edu.co', phone: '573106667788', espCode: 'cardiologia' },
    { fullName: 'Dr. Santiago Vargas', license: 'SV-59201', email: 'santiago.vargas@hun.edu.co', phone: '573107778899', espCode: 'ortopedia' },
    { fullName: 'Dr. Luis Enrique Peña', license: 'LP-48291', email: 'luis.pena@hun.edu.co', phone: '573108889900', espCode: 'ortopedia' },
    { fullName: 'Dra. Patricia Valenzuela', license: 'PV-38192', email: 'patricia.valenzuela@hun.edu.co', phone: '573109990011', espCode: 'ginecologia' },
    { fullName: 'Dra. Sofia Nieto', license: 'SN-29481', email: 'sofia.nieto@hun.edu.co', phone: '573111112233', espCode: 'ginecologia' },
    { fullName: 'Dr. Álvaro Beltrán', license: 'AB-91823', email: 'alvaro.beltran@hun.edu.co', phone: '573112223344', espCode: 'pediatria' },
    { fullName: 'Dra. Elena Gómez', license: 'EG-82719', email: 'elena.gomez@hun.edu.co', phone: '573113334455', espCode: 'pediatria' },
    { fullName: 'Dra. Lucía Restrepo', license: 'LR-73628', email: 'lucia.restrepo@hun.edu.co', phone: '573114445566', espCode: 'oftalmologia' },
    { fullName: 'Dr. Germán Osorio', license: 'GO-64539', email: 'german.osorio@hun.edu.co', phone: '573115556677', espCode: 'oftalmologia' },
    { fullName: 'Dr. Gabriel Fonseca', license: 'GF-55443', email: 'gabriel.fonseca@hun.edu.co', phone: '573116667788', espCode: 'urologia' },
    { fullName: 'Dr. Mauricio Cárdenas', license: 'MC-44332', email: 'mauricio.cardenas@hun.edu.co', phone: '573117778899', espCode: 'urologia' },
  ];

  for (const doc of doctoresDef) {
    const doctor = await prisma.doctor.upsert({
      where: { medicalLicense: doc.license },
      update: {
        fullName: doc.fullName,
        email: doc.email,
        phone: doc.phone,
        active: true,
      },
      create: {
        fullName: doc.fullName,
        medicalLicense: doc.license,
        email: doc.email,
        phone: doc.phone,
        active: true,
      },
    });

    const specialtyId = especialidadesMap.get(doc.espCode);
    if (specialtyId) {
      await prisma.doctorSpecialty.upsert({
        where: {
          doctorId_specialtyId: {
            doctorId: doctor.id,
            specialtyId,
          },
        },
        update: {},
        create: {
          doctorId: doctor.id,
          specialtyId,
        },
      });
    }

    // Horarios regulares (Lunes=1 a Viernes=5, 08:00 a 17:00)
    const existingSchedules = await prisma.doctorSchedule.findMany({
      where: { doctorId: doctor.id },
    });

    if (existingSchedules.length === 0) {
      const espConfig = especialidadesDef.find((e) => e.code === doc.espCode);
      const officeId = espConfig ? consultoriosMap.get(espConfig.officeName) : undefined;
      const validFrom = new Date();
      const validUntil = new Date();
      validUntil.setFullYear(validUntil.getFullYear() + 1);

      // Crear franjas para Lunes(1), Miércoles(3) y Viernes(5)
      for (const dayOfWeek of [1, 2, 3, 4, 5]) {
        const startTime = new Date('1970-01-01T08:00:00Z');
        const endTime = new Date('1970-01-01T17:00:00Z');

        await prisma.doctorSchedule.create({
          data: {
            doctorId: doctor.id,
            locationId: sede.id,
            officeId: officeId || null,
            dayOfWeek,
            startTime,
            endTime,
            slotMinutes: 30,
            validFrom,
            validUntil,
            active: true,
          },
        });
      }
    }
  }
  console.log(`👨‍⚕️ ${doctoresDef.length} médicos y sus agendas semanales asegurados.`);

  console.log('✅ Semillado completado con éxito en PostgreSQL.');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el semillado de la base de datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
