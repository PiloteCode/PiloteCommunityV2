import { SlashCommandBuilder } from 'discord.js';
import { getUser, updateUser, addAchievement } from '../../database/manager.js';

const JOBS = [
  {
    name: 'Développeur',
    minPay: 100,
    maxPay: 300,
    xp: { min: 10, max: 25 },
    messages: [
      "Vous avez développé une nouvelle fonctionnalité",
      "Vous avez corrigé un bug critique",
      "Vous avez optimisé la base de données"
    ]
  },
  {
    name: 'Designer',
    minPay: 80,
    maxPay: 250,
    xp: { min: 8, max: 20 },
    messages: [
      "Vous avez créé une superbe interface",
      "Vous avez redesigné un logo",
      "Vous avez conçu une maquette"
    ]
  }
];

export const data = new SlashCommandBuilder()
  .setName('work')
  .setDescription('Travailler pour gagner de l\'argent');

export async function execute(interaction) {
  const userData = await getUser(interaction.user.id);
  const now = new Date();
  const lastWorked = userData.last_worked ? new Date(userData.last_worked) : null;
  const cooldown = 3600000;

  if (lastWorked && (now - lastWorked) < cooldown) {
    const timeLeft = cooldown - (now - lastWorked);
    const minutesLeft = Math.floor(timeLeft / 60000);
    return interaction.reply({
      content: `⏰ Vous devez attendre encore ${minutesLeft} minutes avant de retravailler.`,
      ephemeral: true
    });
  }

  const job = JOBS[Math.floor(Math.random() * JOBS.length)];
  const earnedMoney = Math.floor(Math.random() * (job.maxPay - job.minPay + 1)) + job.minPay;
  const earnedXP = Math.floor(Math.random() * (job.xp.max - job.xp.min + 1)) + job.xp.min;
  const message = job.messages[Math.floor(Math.random() * job.messages.length)];


  const newXP = userData.experience + earnedXP;
  const newLevel = Math.floor(newXP / 1000) + 1;
  const leveledUp = newLevel > userData.level;


  await updateUser(userData.user_id, {
    balance: userData.balance + earnedMoney,
    experience: newXP,
    level: newLevel,
    last_worked: now.toISOString()
  });


  if (leveledUp) {
    await addAchievement(userData.user_id, `level_${newLevel}`);
  }

  let response = `💼 En tant que ${job.name}, ${message}\n`;
  response += `💵 Vous avez gagné ${earnedMoney} coins\n`;
  response += `📊 +${earnedXP} XP`;

  if (leveledUp) {
    response += `\n🎉 Félicitations! Vous êtes passé au niveau ${newLevel}!`;
  }

  await interaction.reply({ content: response, ephemeral: false });
}
