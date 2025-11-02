// ... (el código anterior que te pasé)

// Cancelar suscripción
router.post('/subscriptions/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.user.id;

    // Verificar que la suscripción existe y pertenece al usuario
    const suscripcionResult = await pool.query(
      `SELECT * FROM suscripciones 
       WHERE id = $1 AND usuario_id = $2 AND estado = 'activa'`,
      [id, usuario_id]
    );

    if (suscripcionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Suscripción no encontrada o ya cancelada' });
    }

    // Cancelar suscripción
    await pool.query(
      `UPDATE suscripciones 
       SET estado = 'cancelada', fecha_cancelacion = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [id]
    );

    res.json({
      success: true,
      message: 'Suscripción cancelada exitosamente'
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Verificar estado de suscripción para un usuario
router.get('/check-subscription/:plan_id', async (req, res) => {
  try {
    const { plan_id } = req.params;
    const usuario_id = req.user.id;

    const suscripcionResult = await pool.query(
      `SELECT * FROM suscripciones 
       WHERE usuario_id = $1 AND plan_id = $2 AND estado = 'activa'`,
      [usuario_id, plan_id]
    );

    res.json({
      hasActiveSubscription: suscripcionResult.rows.length > 0,
      subscription: suscripcionResult.rows[0] || null
    });
  } catch (error) {
    console.error('Error checking subscription:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;