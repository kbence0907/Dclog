module.exports = async function onInteractionCreate(interaction, commands) {
  try {
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    } else if (interaction.isButton() && interaction.customId.startsWith('lookup:')) {
      const lookupCommand = commands.get('lookup');
      await lookupCommand.handleButton(interaction);
    }
  } catch (err) {
    console.error('[interactionCreate] error:', err);
    const payload = { content: '⚠️ Hiba történt a parancs végrehajtása közben.', ephemeral: true };
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload).catch(() => {});
    } else {
      await interaction.reply(payload).catch(() => {});
    }
  }
};
