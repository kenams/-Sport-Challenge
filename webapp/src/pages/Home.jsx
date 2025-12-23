import React from 'react'

export default function Home(){
  return (
    <div className="page home">
      <section className="hero">
        <div className="hero-badge">La nouvelle ère des défis sportifs</div>
        <h1>DEFIEZ LE <span className="accent">MONDE ENTIER</span></h1>
        <p>Lancez des défis sportifs, affrontez des adversaires de votre région, diffusez en live et devenez une légende du sport.</p>
        <div className="hero-ctas">
          <button className="btn primary">Lancer un défi</button>
          <button className="btn ghost">Voir les lives</button>
        </div>
      </section>

      <section className="disciplines">
        <h2>CHOISISSEZ VOTRE <span className="accent">DISCIPLINE</span></h2>
        <p className="muted">5 sports, des milliers de compétitions, une seule plateforme</p>
        <div className="cards">
          <div className="card blue">Natation<br/><small>12 453 joueurs actifs</small></div>
          <div className="card orange">Musculation<br/><small>28 901 joueurs actifs</small></div>
          <div className="card green">Running<br/><small>45 678 joueurs actif</small></div>
          <div className="card yellow">Basketball<br/><small>19 234 joueurs actifs</small></div>
          <div className="card purple">Football<br/><small>67 890 joueurs actifs</small></div>
        </div>
      </section>

      <section className="features">
        <h2>TOUT POUR <span className="accent">GAGNER</span></h2>
        <div className="feature-grid">
          <div className="feature">Défis Mondiaux</div>
          <div className="feature">Live Streaming</div>
          <div className="feature">Paris Sportifs</div>
          <div className="feature">Coach IA</div>
        </div>
      </section>

      <section className="cta-big">
        <h2>PRÊT À DEVENIR UNE LÉGENDE ?</h2>
        <p>Rejoignez des milliers de sportifs et commencez votre ascension dès maintenant.</p>
        <button className="btn primary">Créer mon profil</button>
      </section>
    </div>
  )
}
