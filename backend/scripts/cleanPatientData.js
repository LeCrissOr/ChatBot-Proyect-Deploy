const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 [HUN Clean] Iniciando limpieza de datos de pacientes y agendamientos...');

  try {
    // 1. Eliminar historial de estados de citas
    const deletedHistory = await prisma.appointmentStatusHistory.deleteMany();
    console.log(`✅ Historial de estados de citas eliminado: ${deletedHistory.count}`);

    // 2. Eliminar citas
    const deletedAppointments = await prisma.appointment.deleteMany();
    console.log(`✅ Citas agendadas eliminadas: ${deletedAppointments.count}`);

    // 3. Eliminar tickets de soporte
    const deletedTickets = await prisma.supportTicket.deleteMany();
    console.log(`✅ Tickets de soporte eliminados: ${deletedTickets.count}`);

    // 4. Eliminar cotizaciones quirúrgicas
    const deletedQuotes = await prisma.surgicalQuote.deleteMany();
    console.log(`✅ Cotizaciones quirúrgicas eliminadas: ${deletedQuotes.count}`);

    // 5. Eliminar encuestas NPS
    const deletedSurveys = await prisma.npsSurvey.deleteMany();
    console.log(`✅ Encuestas NPS eliminadas: ${deletedSurveys.count}`);

    // 6. Eliminar mensajes y conversaciones
    const deletedMessages = await prisma.message.deleteMany();
    console.log(`✅ Mensajes de chat eliminados: ${deletedMessages.count}`);

    const deletedConversations = await prisma.conversation.deleteMany();
    console.log(`✅ Conversaciones eliminadas: ${deletedConversations.count}`);

    // 7. Eliminar contactos / pacientes
    const deletedContacts = await prisma.contact.deleteMany();
    console.log(`✅ Pacientes / contactos eliminados: ${deletedContacts.count}`);

    // 8. Limpiar cola de mensajes entrantes
    const deletedJobs = await prisma.incomingMessageJob.deleteMany();
    console.log(`✅ Cola de mensajes entrantes limpia: ${deletedJobs.count}`);

    console.log('\n======================================================');
    console.log('🎉 BASE DE DATOS LOCAL LIMPIA AL 100%');
    console.log('🔒 Usuarios del sistema, catálogo y Hosvital intactos.');
    console.log('======================================================\n');
  } catch (error) {
    console.error('❌ Error durante la limpieza de datos:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
